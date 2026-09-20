export function getLoyaltyRules(profile) {
  const source = profile?.loyalty || {}
  const earnEveryTL = Number(source.earnEveryTL)
  const rewardPoints = Number(source.rewardPoints)
  const rewardName = String(source.rewardName || '').trim().slice(0,100)
  const valid = Number.isFinite(earnEveryTL) && earnEveryTL >= 1 && earnEveryTL <= 100000 && Number.isInteger(rewardPoints) && rewardPoints >= 1 && rewardPoints <= 1000000 && Boolean(rewardName)
  return { enabled: source.enabled === true && valid, earnEveryTL, rewardPoints, rewardName }
}
export function earnedPoints(total, profile) {
  const rules = getLoyaltyRules(profile)
  return rules.enabled ? Math.floor(Math.max(0, Number(total) || 0) / rules.earnEveryTL) : 0
}
export function applyLoyaltyCredit(base, orderId, order, profile, timestamp) {
  if (base?.credits?.[orderId]) return undefined
  const current = base || { visits:0, spend:0, points:0, createdAt:timestamp }
  const spend = Math.max(0, Number(order.total) || 0)
  const points = earnedPoints(spend, profile)
  return { ...current, name:order.customer.name || current.name || '', phone:order.customer.phone || current.phone || '', consent:true, marketingConsent:current.marketingConsent === true, visits:(Number(current.visits)||0)+1, spend:Math.round(((Number(current.spend)||0)+spend)*100)/100, points:(Number(current.points)||0)+points, credits:{...current.credits,[orderId]:{points,spend,at:timestamp}}, lastOrderId:orderId, lastVisitAt:timestamp, updatedAt:timestamp }
}
export function applyRewardRedemption(base, redemptionId, rules, staffId, timestamp) {
  if (!base || !rules.enabled || base.redemptions?.[redemptionId] || (Number(base.points)||0) < rules.rewardPoints) return undefined
  return { ...base, points:Number(base.points)-rules.rewardPoints, redemptions:{...base.redemptions,[redemptionId]:{points:rules.rewardPoints,reward:rules.rewardName,staffId:staffId||null,at:timestamp}}, updatedAt:timestamp }
}
