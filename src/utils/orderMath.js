/**
 * Canonical logic for order amount computation.
 * Shared between OrderRow and DetailPanel.
 */
export function computeAmounts(items, charges, discountMode, discountVal) {
  const subtotal = (items || []).reduce((s, i) => s + (Number(i.total) || 0), 0)
  const dVal = Number(discountVal) || 0
  const discountAmt = discountMode === '%'
    ? Math.round(subtotal * dVal / 100)
    : dVal
  const subtotalNet = Math.max(0, subtotal - discountAmt)

  const c = charges || {}
  const tipVal = Number(c.tipVal) || 0
  const tipAmt = (c.tipMode || '%') === '%'
    ? Math.round(subtotalNet * tipVal / 100)
    : tipVal

  const deliveryAmt = Number(c.delivery) || 0
  const servicioAmt = Number(c.servicio) || 0
  const empaqueAmt = Number(c.empaque) || 0

  const total = subtotalNet + deliveryAmt + tipAmt + servicioAmt + empaqueAmt

  return { subtotal, discountAmt, subtotalNet, tipAmt, deliveryAmt, servicioAmt, empaqueAmt, total }
}

export function computeOrderTotal(order) {
  const { total } = computeAmounts(
    order.items,
    order.charges,
    order.discountMode,
    order.discountVal
  )
  return total
}
