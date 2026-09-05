import { apiClient } from './client'
import type { RiskFormula } from './types'

export async function getRiskFormula(): Promise<RiskFormula> {
  const { data } = await apiClient.get<RiskFormula>('/risk-scores/formula')
  return data
}
