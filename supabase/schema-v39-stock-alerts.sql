-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v39 — sale-time low-stock alerts (live push).
--
-- Recreates public.complete_sale with ONE addition: after the atomic
-- stock decrement, any product that landed at/below its
-- low_stock_threshold gets an automation_events row ('stock_alert').
-- automation_events is already in the supabase_realtime publication
-- (schema v32), so the dashboard's automation cards receive the alert
-- over the websocket the moment the sale commits — fulfilling
-- "every sale → threshold check → push → live dashboard update"
-- without waiting for the 30-minute automation heartbeat.
--
-- Everything else in complete_sale is byte-identical to v31/v32's
-- audited definition. Run AFTER schema v32 (automation_events) and
-- only once per database (idempotent via CREATE OR REPLACE).
-- ════════════════════════════════════════════════════════════════

create or replace function public.complete_sale(
  p_transaction_id uuid,
  p_user_id uuid,
  p_customer_id uuid,
  p_receipt_number text,
  p_items jsonb,
  p_subtotal numeric,
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_discount numeric,
  p_discount_reason text,
  p_total numeric,
  p_default_tax_rate numeric,
  p_payment_method text,
  p_payments jsonb,
  p_served_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  item jsonb;
  pay jsonb;
  unit_item jsonb;
  product_row public.products%rowtype;
  product_id uuid;
  quantity numeric;
  factor numeric;
  unit_price numeric;
  expected_price numeric;
  expected_factor numeric;
  gst_rate numeric;
  default_rate numeric := greatest(0, coalesce(p_default_tax_rate, 0));
  base numeric;
  effective_base numeric;
  line_discount numeric;
  subtotal_calc numeric := 0;
  line_discount_calc numeric := 0;
  pool numeric := 0;
  cart_discount numeric;
  cart_share numeric;
  taxable numeric;
  tax_calc numeric := 0;
  total_calc numeric;
  expected_rate numeric;
  payment_sum numeric := 0;
  consumed numeric;
  inserted_id uuid;
  affected integer;
  existing_user uuid;
  source text;
  max_amount numeric := 9999999999.99;
begin
  if auth.uid() is null or p_user_id is null or not public.can_direct_capability(p_user_id, 'sales:create') then
    raise exception 'Not authorised for this business';
  end if;
  if p_transaction_id is null or nullif(trim(p_receipt_number), '') is null then
    raise exception 'Transaction id and receipt number are required';
  end if;
  if length(trim(p_receipt_number)) > 100 then
    raise exception 'Receipt number is too long';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Sale items must be an array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A sale must contain at least one item';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'A sale cannot contain more than 200 lines';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'Payment lines must be an array';
  end if;
  if jsonb_array_length(p_payments) > 20 then
    raise exception 'A sale cannot contain more than 20 payment lines';
  end if;
  if p_subtotal is null or p_tax_rate is null or p_tax_amount is null
     or p_discount is null or p_total is null or p_default_tax_rate is null
     or lower(p_subtotal::text) in ('nan','infinity','-infinity')
     or lower(p_tax_rate::text) in ('nan','infinity','-infinity')
     or lower(p_tax_amount::text) in ('nan','infinity','-infinity')
     or lower(p_discount::text) in ('nan','infinity','-infinity')
     or lower(p_total::text) in ('nan','infinity','-infinity')
     or lower(p_default_tax_rate::text) in ('nan','infinity','-infinity')
     or p_subtotal < 0 or p_subtotal > max_amount
     or p_tax_rate < 0 or p_tax_rate > 100
     or p_tax_amount < 0 or p_tax_amount > max_amount
     or p_discount < 0 or p_discount > max_amount
     or p_total < 0 or p_total > max_amount
     or p_default_tax_rate < 0 or p_default_tax_rate > 100 then
    raise exception 'Sale amounts are invalid';
  end if;
  default_rate := round(p_default_tax_rate, 2);
  if length(coalesce(p_discount_reason, '')) > 500 then raise exception 'Discount reason is too long'; end if;
  if length(coalesce(p_served_by, '')) > 120 then raise exception 'Cashier name is too long'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','card','upi','wallet','other','split') then
    raise exception 'Payment method is invalid';
  end if;

  -- Fast idempotency path. This also prevents a replay from touching stock a
  -- second time after a client timeout.
  select t.user_id into existing_user from public.transactions t where t.id = p_transaction_id;
  if found then
    if existing_user <> p_user_id then raise exception 'Transaction id belongs to another business'; end if;
    return jsonb_build_object('id', p_transaction_id, 'duplicate', true);
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.user_id = p_user_id
  ) then
    raise exception 'Customer does not belong to this business';
  end if;

  -- Lock every SKU and validate the client payload against the current catalog
  -- before any write. A cashier cannot alter a price or sell concurrent stock.
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object'
       or item->>'product_id' is null
       or item->>'product_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or item->'quantity' is null or jsonb_typeof(item->'quantity') <> 'number'
       or item->'unit_price' is null or jsonb_typeof(item->'unit_price') <> 'number'
       or (item ? 'factor' and jsonb_typeof(item->'factor') not in ('number','null'))
       or (item ? 'gst_rate' and jsonb_typeof(item->'gst_rate') not in ('number','null'))
       or (item ? 'line_discount' and jsonb_typeof(item->'line_discount') not in ('number','null'))
       or (item ? 'unit' and (jsonb_typeof(item->'unit') not in ('string','null') or (jsonb_typeof(item->'unit') = 'string' and length(item->>'unit') > 64)))
       or (item ? 'gst_source' and jsonb_typeof(item->'gst_source') not in ('string','null'))
       or (item ? 'price_includes_tax' and jsonb_typeof(item->'price_includes_tax') not in ('boolean','null'))
       or (item ? 'line_discount_note' and (jsonb_typeof(item->'line_discount_note') not in ('string','null') or (jsonb_typeof(item->'line_discount_note') = 'string' and length(item->>'line_discount_note') > 500))) then
      raise exception 'Invalid sale line';
    end if;

    product_id := (item->>'product_id')::uuid;
    quantity := round((item->>'quantity')::numeric, 3);
    factor := round(coalesce((item->>'factor')::numeric, 1), 6);
    unit_price := round((item->>'unit_price')::numeric, 2);
    if lower(quantity::text) in ('nan','infinity','-infinity')
       or lower(factor::text) in ('nan','infinity','-infinity')
       or lower(unit_price::text) in ('nan','infinity','-infinity')
       or quantity <= 0 or quantity > 1000000
       or factor <= 0 or factor > 1000
       or unit_price < 0 or unit_price > max_amount then
      raise exception 'Invalid sale line';
    end if;

    select * into product_row
    from public.products
    where id = product_id and user_id = p_user_id and active = true
    for update;
    if not found then raise exception 'Product is unavailable'; end if;
    if product_row.price is null
       or lower(product_row.price::text) in ('nan','infinity','-infinity')
       or product_row.price < 0 or product_row.price > max_amount
       or product_row.stock_quantity is null
       or lower(product_row.stock_quantity::text) in ('nan','infinity','-infinity')
       or product_row.stock_quantity < 0
       or product_row.gst_rate is null
       or lower(product_row.gst_rate::text) in ('nan','infinity','-infinity')
       or product_row.gst_rate < 0 or product_row.gst_rate > 100 then
      raise exception 'Product catalog data is invalid';
    end if;

    if nullif(item->>'unit', '') is null then
      expected_price := round(product_row.price, 2);
      expected_factor := 1;
    else
      if product_row.units is not null and jsonb_typeof(product_row.units) <> 'array' then
        raise exception 'Product pricing data is invalid for %', product_row.name;
      end if;
      unit_item := null;
      select value into unit_item
      from jsonb_array_elements(coalesce(product_row.units, '[]'::jsonb))
      where value->>'unit' = item->>'unit'
      limit 1;
      if unit_item is null
         or jsonb_typeof(unit_item) <> 'object'
         or unit_item->'price' is null
         or jsonb_typeof(unit_item->'price') <> 'number'
         or (unit_item ? 'factor' and jsonb_typeof(unit_item->'factor') <> 'number') then
        raise exception 'Pricing unit is unavailable for %', product_row.name;
      end if;
      expected_price := round((unit_item->>'price')::numeric, 2);
      expected_factor := round(coalesce((unit_item->>'factor')::numeric, 1), 6);
      if lower(expected_price::text) in ('nan','infinity','-infinity')
         or lower(expected_factor::text) in ('nan','infinity','-infinity')
         or expected_price < 0 or expected_price > max_amount
         or expected_factor <= 0 or expected_factor > 1000 then
        raise exception 'Product pricing data is invalid for %', product_row.name;
      end if;
    end if;
    if unit_price <> expected_price or factor <> expected_factor then
      raise exception 'Price or unit changed for % — refresh the sale', product_row.name;
    end if;
    consumed := quantity * factor;
    if lower(consumed::text) in ('nan','infinity','-infinity') or consumed <= 0 or consumed > max_amount then
      raise exception 'Invalid sale quantity';
    end if;
    if product_row.stock_quantity < consumed then
      raise exception 'Insufficient stock for %', product_row.name;
    end if;

    source := coalesce(item->>'gst_source', 'manual');
    gst_rate := round(greatest(0, coalesce((item->>'gst_rate')::numeric, 0)), 2);
    if lower(gst_rate::text) in ('nan','infinity','-infinity') or gst_rate > 100 then raise exception 'GST rate is invalid'; end if;
    if source = 'product' and abs(gst_rate - coalesce(product_row.gst_rate, 0)) > 0.01 then
      raise exception 'GST rate changed for % — refresh the sale', product_row.name;
    elsif source = 'sale' and abs(gst_rate - default_rate) > 0.01 then
      raise exception 'Sale tax rate changed — refresh the sale';
    elsif source not in ('product','sale','manual') then
      raise exception 'GST source is invalid';
    end if;

    base := case when coalesce((item->>'price_includes_tax')::boolean, false) and gst_rate > 0
      then quantity * unit_price / (1 + gst_rate / 100)
      else quantity * unit_price end;
    line_discount := round(greatest(0, coalesce((item->>'line_discount')::numeric, 0)), 2);
    if lower(line_discount::text) in ('nan','infinity','-infinity')
       or line_discount < 0 or line_discount > max_amount
       or line_discount > base + 0.01 then
      raise exception 'Line discount is invalid';
    end if;
    line_discount := least(line_discount, round(base, 2));
    subtotal_calc := subtotal_calc + base;
    line_discount_calc := line_discount_calc + line_discount;
    pool := pool + greatest(0, base - line_discount);
    if subtotal_calc > max_amount or pool > max_amount then
      raise exception 'Sale is too large';
    end if;
  end loop;

  subtotal_calc := round(subtotal_calc, 2);
  line_discount_calc := round(line_discount_calc, 2);
  cart_discount := round(coalesce(p_discount, 0) - line_discount_calc, 2);
  if cart_discount < -0.01 or cart_discount > round(pool, 2) + 0.01 then
    raise exception 'Discount total is inconsistent';
  end if;
  cart_discount := greatest(0, least(cart_discount, round(pool, 2)));

  -- Recalculate tax and total from the locked catalog lines. Cart discount is
  -- allocated proportionally exactly as the browser's POS math does.
  for item in select value from jsonb_array_elements(p_items) loop
    product_id := (item->>'product_id')::uuid;
    quantity := round((item->>'quantity')::numeric, 3);
    factor := round(coalesce((item->>'factor')::numeric, 1), 6);
    unit_price := round((item->>'unit_price')::numeric, 2);
    select * into product_row from public.products where id = product_id and user_id = p_user_id;
    gst_rate := round(greatest(0, coalesce((item->>'gst_rate')::numeric, 0)), 2);
    line_discount := round(greatest(0, coalesce((item->>'line_discount')::numeric, 0)), 2);
    base := case when coalesce((item->>'price_includes_tax')::boolean, false) and gst_rate > 0
      then quantity * unit_price / (1 + gst_rate / 100)
      else quantity * unit_price end;
    effective_base := greatest(0, base - line_discount);
    cart_share := case when pool > 0 then round(cart_discount * effective_base / pool, 2) else 0 end;
    taxable := round(greatest(0, effective_base - cart_share), 2);
    tax_calc := tax_calc + round(taxable * gst_rate / 100, 2);
  end loop;
  tax_calc := round(tax_calc, 2);
  total_calc := round(pool - cart_discount + tax_calc, 2);
  if lower(tax_calc::text) in ('nan','infinity','-infinity')
     or lower(total_calc::text) in ('nan','infinity','-infinity')
     or tax_calc < 0 or tax_calc > max_amount
     or total_calc < 0 or total_calc > max_amount then
    raise exception 'Sale is too large';
  end if;
  expected_rate := case when round(pool - cart_discount, 2) > 0
    then round(tax_calc / round(pool - cart_discount, 2) * 100, 2) else 0 end;

  if abs(coalesce(p_subtotal, 0) - subtotal_calc) > 0.05
     or abs(coalesce(p_tax_amount, 0) - tax_calc) > 0.05
     or abs(coalesce(p_total, 0) - total_calc) > 0.05
     or abs(coalesce(p_tax_rate, 0) - expected_rate) > 0.15 then
    raise exception 'Sale totals changed — refresh the cart and try again';
  end if;

  for pay in select value from jsonb_array_elements(p_payments) loop
    if jsonb_typeof(pay) <> 'object'
       or pay->>'method' is null
       or jsonb_typeof(pay->'method') <> 'string'
       or pay->>'method' not in ('cash','card','upi','wallet','other')
       or pay->'amount' is null or jsonb_typeof(pay->'amount') <> 'number'
       or (pay ? 'reference' and (jsonb_typeof(pay->'reference') not in ('string','null') or (jsonb_typeof(pay->'reference') = 'string' and length(pay->>'reference') > 200))) then
      raise exception 'Tender line is invalid';
    end if;
    if lower(((pay->>'amount')::numeric)::text) in ('nan','infinity','-infinity')
       or (pay->>'amount')::numeric <= 0
       or (pay->>'amount')::numeric > max_amount then
      raise exception 'Tender amount must be positive and reasonable';
    end if;
    payment_sum := payment_sum + round((pay->>'amount')::numeric, 2);
    if payment_sum > max_amount then raise exception 'Tender total is too large'; end if;
  end loop;
  payment_sum := round(payment_sum, 2);
  if abs(payment_sum - total_calc) > 0.02 then raise exception 'Tender total does not match sale total'; end if;
  if total_calc > 0 and jsonb_array_length(p_payments) = 0 then raise exception 'A paid sale needs a tender'; end if;
  if p_payment_method = 'split' and jsonb_array_length(p_payments) < 2 then raise exception 'Split payment needs two tenders'; end if;
  if p_payment_method <> 'split' and jsonb_array_length(p_payments) > 1 then raise exception 'Use split payment for multiple tenders'; end if;
  if p_payment_method <> 'split' and jsonb_array_length(p_payments) = 1
     and (p_payments->0)->>'method' <> p_payment_method then
    raise exception 'Payment method does not match tender';
  end if;

  -- Store server-normalized line data, not a customer-controlled product name.
  declare normalized_items jsonb := '[]'::jsonb;
  begin
    for item in select value from jsonb_array_elements(p_items) loop
      product_id := (item->>'product_id')::uuid;
      quantity := round((item->>'quantity')::numeric, 3);
      factor := round(coalesce((item->>'factor')::numeric, 1), 6);
      unit_price := round((item->>'unit_price')::numeric, 2);
      gst_rate := round(greatest(0, coalesce((item->>'gst_rate')::numeric, 0)), 2);
      line_discount := round(greatest(0, coalesce((item->>'line_discount')::numeric, 0)), 2);
      select * into product_row from public.products where id = product_id and user_id = p_user_id;
      normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
        'product_id', product_id, 'name', product_row.name,
        'quantity', quantity, 'unit_price', unit_price,
        'unit', nullif(item->>'unit',''), 'factor', factor,
        'gst_rate', gst_rate, 'gst_source', coalesce(item->>'gst_source','manual'),
        'price_includes_tax', coalesce((item->>'price_includes_tax')::boolean,false),
        'line_discount', line_discount,
        'line_discount_note', nullif(item->>'line_discount_note','')
      ));
    end loop;

    insert into public.transactions (
      id, user_id, customer_id, receipt_number, items, subtotal, tax_rate,
      tax_amount, discount, discount_reason, total, payment_method, status,
      served_by
    ) values (
      p_transaction_id, p_user_id, p_customer_id, trim(p_receipt_number), normalized_items,
      subtotal_calc, expected_rate, tax_calc, round(line_discount_calc + cart_discount, 2),
      nullif(trim(coalesce(p_discount_reason,'')), ''), total_calc,
      p_payment_method, 'completed', nullif(trim(coalesce(p_served_by,'')), '')
    ) on conflict (id) do nothing returning id into inserted_id;
  end;

  if inserted_id is null then
    select user_id into existing_user from public.transactions where id = p_transaction_id;
    if existing_user <> p_user_id then raise exception 'Transaction id belongs to another business'; end if;
    return jsonb_build_object('id', p_transaction_id, 'duplicate', true);
  end if;

  for pay in select value from jsonb_array_elements(p_payments) loop
    insert into public.sale_payments (user_id, transaction_id, method, amount, reference)
    values (p_user_id, p_transaction_id, pay->>'method', round((pay->>'amount')::numeric,2), nullif(pay->>'reference',''));
  end loop;

  for item in select value from jsonb_array_elements(p_items) loop
    product_id := (item->>'product_id')::uuid;
    quantity := round((item->>'quantity')::numeric, 3);
    factor := round(coalesce((item->>'factor')::numeric, 1), 6);
    consumed := quantity * factor;
    update public.products
      set stock_quantity = stock_quantity - consumed, updated_at = now()
      where id = product_id and user_id = p_user_id and active = true and stock_quantity >= consumed;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Stock changed during checkout — no sale was kept'; end if;
  end loop;

  -- ── Sale-time low-stock alerts (schema v39) ─────────────────────
  -- Every product this sale pushed to (or below) its threshold emits an
  -- automation_events row. That table is in the supabase_realtime
  -- publication, so every logged-in device gets the alert pushed over
  -- the websocket the instant the bill is saved — no polling, no
  -- 30-minute heartbeat wait. The function is SECURITY DEFINER, and
  -- automation_events has no client-insert policy, so only this RPC
  -- (or the service role) can write these rows.
  insert into public.automation_events (user_id, type, title, body, severity, money_impact, receipt)
  select
      p_user_id,
      'stock_alert',
      'Low stock: ' || pr.name || ' — ' || pr.stock_quantity || ' left',
      case
        when pr.stock_quantity <= 0
          then pr.name || ' is OUT OF STOCK after this sale. Reorder before you lose the next customer.'
        else pr.name || ' has ' || pr.stock_quantity || ' unit'
             || (case when pr.stock_quantity = 1 then '' else 's' end)
             || ' left — below your alert level of ' || pr.low_stock_threshold || '.'
      end,
      case when pr.stock_quantity <= 0 then 'critical' else 'warning' end,
      0,
      jsonb_build_object(
        'product_id', pr.id, 'product', pr.name,
        'stock', pr.stock_quantity, 'threshold', pr.low_stock_threshold,
        'receipt_number', trim(p_receipt_number)
      )
  from public.products pr
  where pr.user_id = p_user_id
    and pr.stock_quantity <= pr.low_stock_threshold
    and pr.id in (
      select (i->>'product_id')::uuid
      from jsonb_array_elements(p_items) i
    );

  if p_customer_id is not null then
    update public.customers c set
      total_spent = coalesce(a.spent,0), total_orders = coalesce(a.orders,0),
      first_purchase_at = a.first_purchase, last_purchase_at = a.last_purchase
    from (
      select coalesce(sum(total),0) spent, count(*) orders, min(created_at) first_purchase,
             max(created_at) last_purchase
      from public.transactions where customer_id = p_customer_id and status = 'completed'
    ) a where c.id = p_customer_id and c.user_id = p_user_id;
  end if;

  insert into public.activity_logs (user_id, action_type, description, time_saved_minutes, money_saved, provider, metadata)
  values (p_user_id, 'invoice', 'Sale ' || trim(p_receipt_number) || ' — ₹' || total_calc::text,
          8, 4, 'pos', jsonb_build_object('receipt_number', trim(p_receipt_number), 'payment_method', p_payment_method));

  return jsonb_build_object('id', p_transaction_id, 'duplicate', false, 'total', total_calc);
end;
$function$;
