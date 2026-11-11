export type TargetType = 'fee_gmv' | 'fee_gsv' | 'gmv' | 'gsv';

export interface CalculatorInputs {
  payRoi: number | string; // 支付 ROI
  booth: number | string; // 达人坑位费（元）
  rate: number | string; // 达人佣金比例（0-100%）
  ret: number | string; // 退货率（0-100%，可为空表示未指定）
  targetType: TargetType; // 目标口径
  targetValue: number | string; // 目标数值
  grossMargin?: number | string; // 选填：产品毛利率（0-100%），用于保本分析
}

export interface CalculationResult {
  isValid: boolean;
  errorMessage?: string;
  warningMessage?: string;
  infoMessage?: string;

  // 输入快照（规范化后的数字）
  params: {
    payRoi: number;
    booth: number;
    commissionRate: number; // 0-1
    returnRate: number; // 0-1
    isReturnBlank: boolean;
    targetType: TargetType;
    targetValue: number;
    grossMargin: number; // 0-1
  };

  // 成交额
  gmv: number; // 退款前支付GMV
  gsv: number; // 退款后结算成交GSV
  refundAmount: number; // 退款损耗 = GMV - GSV
  isGmvHidden?: boolean;
  isGsvHidden?: boolean;

  // 费用
  commission: number; // 达人佣金（GSV口径估算）
  talentIncome: number; // 达人总收益（坑位费 + 达人佣金）
  adSpend: number; // 千川广告消耗
  totalCost: number; // 总营销费用

  // 费比
  feeRatio: number; // 综合费比（GMV口径）= 总费用 ÷ GMV
  settleFeeRatio: number; // 结算综合费比（GSV口径）= 总费用 ÷ GSV
  adFeeRatio: number; // 广告投流费比 = 千川消耗 ÷ GMV
  talentFeeRatio: number; // 达人费比 = 达人总收益 ÷ GMV

  // ROI
  paymentRoi: number; // 支付 ROI = GMV ÷ 千川消耗
  netRoi: number; // 净成交 ROI = GSV ÷ 千川消耗
  isNetRoiHidden?: boolean;
  fullCostRoi: number; // 全成本综合 ROI = GMV ÷ 总费用
  gsvCostRoi: number; // 结算全成本 ROI = GSV ÷ 总费用

  // 保本与经营分析（基于毛利率）
  breakevenPayRoi?: number; // 达到保本所需的最低支付 ROI
  breakevenFullRoi?: number; // 达到保本所需的全成本 ROI
  estimatedGrossProfit?: number; // 预估毛利 = GSV * 毛利率
  estimatedNetProfit?: number; // 预估营销后营业利润 = 毛利 - 总营销费用
  estimatedNetProfitMargin?: number; // 预估营销后利润率 = 利润 ÷ GSV
}

export interface PresetScenario {
  id: string;
  name: string;
  category: string;
  description: string;
  inputs: CalculatorInputs;
}

export interface SavedScenario {
  id: string;
  name: string;
  timestamp: number;
  inputs: CalculatorInputs;
  result: CalculationResult;
}

