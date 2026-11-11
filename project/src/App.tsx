import React, { useState, useEffect, useRef } from 'react';
import { calculateCommercialMetrics } from './utils/calculator';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  RotateCcw, 
  Download, 
  Printer, 
  RotateCw, 
  Trash2, 
  ArrowUpRight, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Copy, 
  Check, 
  Sun, 
  Moon,
  PieChart,
  Calculator,
  ChevronUp,
  ChevronDown,
  Target
} from 'lucide-react';

type TargetType = 'fee_gmv' | 'fee_gsv' | 'gmv' | 'gsv';

interface TargetDescription {
  label: string;
  placeholder: string;
  hint: string;
  formula: string;
  unit: string;
}

const DESCRIPTIONS: Record<TargetType, TargetDescription> = {
  fee_gmv: {
    label: '目标综合费比（GMV口径，%）',
    placeholder: '请输入目标综合费比，例如 60',
    hint: '百分比按百分数输入，例如输入 60 代表 60%',
    formula: 'GMV = 坑位费 ÷（目标综合费比 − 佣金比例 ×（1 − 退货率）− 1 ÷ 支付 ROI）',
    unit: '%',
  },
  fee_gsv: {
    label: '结算综合费比（GSV口径，%）',
    placeholder: '请输入结算综合费比，例如 65',
    hint: '百分比按百分数输入，例如输入 60 代表 60%',
    formula: 'GMV = 坑位费 ÷［（结算综合费比 − 佣金比例）×（1 − 退货率）− 1 ÷ 支付 ROI］',
    unit: '%',
  },
  gmv: {
    label: '目标 GMV（元）',
    placeholder: '请输入退款前 GMV，例如 300000',
    hint: '输入退款前成交金额，系统按退货率计算 GSV',
    formula: 'GSV = GMV ×（1 − 退货率）',
    unit: '元',
  },
  gsv: {
    label: '目标 GSV（元）',
    placeholder: '请输入退款后 GSV，例如 240000',
    hint: '输入退款后结算金额，系统按退货率反推 GMV',
    formula: 'GMV = GSV ÷（1 − 退货率）',
    unit: '元',
  },
};

interface ModeCardConfig {
  id: TargetType;
  name: string;
  badge: string;
  title: string;
  sub: string;
  unit: string;
  iconName: 'percent' | 'pie' | 'trending' | 'dollar';
}

const MODE_CARDS: ModeCardConfig[] = [
  {
    id: 'fee_gmv',
    name: '按目标综合费比反推（GMV口径）',
    badge: 'GMV口径',
    title: '综合费比反推',
    sub: '以支付成交额为基准反推',
    unit: '%',
    iconName: 'percent',
  },
  {
    id: 'fee_gsv',
    name: '按结算综合费比反推（GSV口径）',
    badge: 'GSV口径',
    title: '结算费比反推',
    sub: '以退款后结算额为基准测算',
    unit: '%',
    iconName: 'pie',
  },
  {
    id: 'gmv',
    name: '按目标 GMV 测算',
    badge: '支付成交',
    title: '目标 GMV 测算',
    sub: '输入退款前成交正推费比',
    unit: '¥',
    iconName: 'trending',
  },
  {
    id: 'gsv',
    name: '按目标 GSV 测算',
    badge: '结算成交',
    title: '目标 GSV 测算',
    sub: '输入扣款后结算反推消耗',
    unit: '¥',
    iconName: 'dollar',
  },
];

const MODE_TABS = MODE_CARDS;

interface CalculationState {
  gmv: string;
  gsv: string;
  comm: string;
  talentIncome: string;
  ads: string;
  total: string;
  fee: string;
  settleFee: string;
  adFee: string;
  talentFee: string;
  payRoi: string;
  netRoi: string;
  fullRoi: string;
  dBooth: string;
  dComm: string;
  dTalentIncome: string;
  dAds: string;
  dTotal: string;
  // Raw numeric costs for proportional bar
  boothRaw: number;
  commRaw: number;
  adsRaw: number;
  totalRaw: number;
  hideGmv: boolean;
  hideGsv: boolean;
  hideNetRoi: boolean;
}

const EMPTY_STATE: CalculationState = {
  gmv: '—',
  gsv: '—',
  comm: '—',
  talentIncome: '—',
  ads: '—',
  total: '—',
  fee: '—',
  settleFee: '—',
  adFee: '—',
  talentFee: '—',
  payRoi: '—',
  netRoi: '—',
  fullRoi: '—',
  dBooth: '—',
  dComm: '—',
  dTalentIncome: '—',
  dAds: '—',
  dTotal: '—',
  boothRaw: 0,
  commRaw: 0,
  adsRaw: 0,
  totalRaw: 0,
  hideGmv: false,
  hideGsv: false,
  hideNetRoi: false,
};

export default function App() {
  // Theme state: dark obsidian by default
  const [isDark, setIsDark] = useState<boolean>(true);

  // Input fields
  const [payRoi, setPayRoi] = useState<string>('3');
  const [booth, setBooth] = useState<string>('50000');
  const [rate, setRate] = useState<string>('5');
  const [ret, setRet] = useState<string>('20');
  const [targetType, setTargetType] = useState<TargetType>('fee_gmv');
  const [targetValue, setTargetValue] = useState<string>('60');

  // Status message
  const [status, setStatus] = useState<{ type: 'error' | 'warn' | 'ok' | ''; text: string }>({
    type: '',
    text: '',
  });

  // Calculation results
  const [calc, setCalc] = useState<CalculationState>(EMPTY_STATE);

  // Button feedback labels
  const [resetLabel, setResetLabel] = useState('恢复示例数据');
  const [clearLabel, setClearLabel] = useState('清空输入');

  // Copy toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Track unit change
  const lastTargetKindRef = useRef<'fee' | 'amount'>('fee');
  const lastResultRef = useRef<any>(null);

  // Initialize theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (text === '—') return;
    navigator.clipboard.writeText(text.replace(/[¥%]/g, '').trim());
    showToast(`已复制 ${label}: ${text}`);
  };

  const formatMoney = (x: number) =>
    Number.isFinite(x) ? '¥' + Math.round(x).toLocaleString('zh-CN') : '—';
  const formatPct = (x: number) =>
    Number.isFinite(x) ? (x * 100).toFixed(2) + '%' : '—';

  // Micro-stepper adjustment helper with boundary clamping and precision handling
  const handleStep = (
    field: 'payRoi' | 'booth' | 'rate' | 'ret' | 'targetValue',
    step: number,
    isIncrement: boolean,
    minVal: number = 0,
    maxVal?: number
  ) => {
    let currentStr = '';
    if (field === 'payRoi') currentStr = payRoi;
    else if (field === 'booth') currentStr = booth;
    else if (field === 'rate') currentStr = rate;
    else if (field === 'ret') currentStr = ret;
    else if (field === 'targetValue') currentStr = targetValue;

    const currentNum = parseFloat(currentStr) || 0;
    let nextNum = isIncrement ? currentNum + step : currentNum - step;
    if (minVal !== undefined && nextNum < minVal) nextNum = minVal;
    if (maxVal !== undefined && nextNum > maxVal) nextNum = maxVal;

    const precision = step < 1 ? 2 : 0;
    const formatted =
      precision > 0
        ? parseFloat(nextNum.toFixed(precision)).toString()
        : Math.round(nextNum).toString();

    if (field === 'payRoi') setPayRoi(formatted);
    else if (field === 'booth') setBooth(formatted);
    else if (field === 'rate') setRate(formatted);
    else if (field === 'ret') setRet(formatted);
    else if (field === 'targetValue') setTargetValue(formatted);
  };

  // Core calculation
  const calculate = () => {
    const sharedResult = calculateCommercialMetrics({ payRoi, booth, rate, ret, targetType, targetValue });
    if (!sharedResult.isValid) {
      setCalc(EMPTY_STATE);
      setStatus({ type: 'error', text: sharedResult.errorMessage ?? '输入无效，请检查参数。' });
      lastResultRef.current = null;
      return;
    }

    const roiText = payRoi.trim();
    const boothText = booth.trim();
    const rateText = rate.trim();
    const targetText = targetValue.trim();
    const returnText = ret.trim();

    const payRoiInput = Number(roiText);
    const boothNum = Number(boothText);
    const rateNum = Number(rateText) / 100;
    const returnBlank = returnText === '';
    const returnRate = returnBlank ? 0 : Number(returnText) / 100;
    const isFeeTarget = targetType === 'fee_gmv' || targetType === 'fee_gsv';

    const targetBasis =
      targetType === 'fee_gmv'
        ? '按目标综合费比反推（GMV口径）'
        : targetType === 'fee_gsv'
        ? '按结算综合费比反推（GSV口径）'
        : targetType === 'gmv'
        ? '按目标 GMV 测算'
        : '按目标 GSV 测算';

    if (!roiText || !boothText || !rateText || !targetText) {
      setCalc(EMPTY_STATE);
      setStatus({
        type: 'error',
        text: '请填写支付 ROI、达人坑位费、佣金比例和所选目标值。',
      });
      lastResultRef.current = null;
      return;
    }

    if (
      !Number.isFinite(payRoiInput) ||
      payRoiInput <= 0 ||
      !Number.isFinite(boothNum) ||
      boothNum < 0 ||
      !Number.isFinite(rateNum) ||
      rateNum < 0 ||
      rateNum > 1
    ) {
      setCalc(EMPTY_STATE);
      setStatus({
        type: 'error',
        text: '输入无效：支付 ROI 必须大于 0；坑位费不能为负数；佣金比例须在 0% 至 100% 之间。',
      });
      lastResultRef.current = null;
      return;
    }

    if (
      !returnBlank &&
      (!Number.isFinite(returnRate) || returnRate < 0 || returnRate >= 1)
    ) {
      setCalc(EMPTY_STATE);
      setStatus({
        type: 'error',
        text: '退货率须在 0%（含）至 100%（不含）之间，或留空。',
      });
      lastResultRef.current = null;
      return;
    }

    const targetValueNum = Number(targetText);
    if (!Number.isFinite(targetValueNum) || targetValueNum <= 0) {
      setCalc(EMPTY_STATE);
      setStatus({
        type: 'error',
        text: isFeeTarget ? '目标费比必须大于 0。' : '目标成交金额必须大于 0。',
      });
      lastResultRef.current = null;
      return;
    }

    let gmv = 0;
    let gsv = 0;

    if (targetType === 'fee_gmv') {
      if (boothNum <= 0) {
        setCalc(EMPTY_STATE);
        setStatus({
          type: 'error',
          text: '按费比反推需要大于 0 的坑位费，才能反推出正数 GMV。',
        });
        lastResultRef.current = null;
        return;
      }
      const d = targetValueNum / 100 - rateNum * (1 - returnRate) - 1 / payRoiInput;
      if (d <= 0) {
        setCalc(EMPTY_STATE);
        setStatus({
          type: 'error',
          text: '目标综合费比须大于 GSV口径佣金率 ×（1 − 退货率）+ 1/支付 ROI，才能反推出正数 GMV。',
        });
        lastResultRef.current = null;
        return;
      }
      gmv = boothNum / d;
      gsv = gmv * (1 - returnRate);
    } else if (targetType === 'fee_gsv') {
      if (boothNum <= 0) {
        setCalc(EMPTY_STATE);
        setStatus({
          type: 'error',
          text: '按费比反推需要大于 0 的坑位费，才能反推出正数 GMV。',
        });
        lastResultRef.current = null;
        return;
      }
      const d = (targetValueNum / 100 - rateNum) * (1 - returnRate) - 1 / payRoiInput;
      if (d <= 0) {
        setCalc(EMPTY_STATE);
        setStatus({
          type: 'error',
          text: '结算综合费比须满足（目标费比 − 佣金比例）×（1 − 退货率）> 1/支付 ROI，才能反推出正数 GMV。',
        });
        lastResultRef.current = null;
        return;
      }
      gmv = boothNum / d;
      gsv = gmv * (1 - returnRate);
    } else if (targetType === 'gmv') {
      gmv = targetValueNum;
      gsv = gmv * (1 - returnRate);
    } else {
      gsv = targetValueNum;
      gmv = gsv / (1 - returnRate);
    }

    const commission = gsv * rateNum;
    const talentIncome = boothNum + commission;
    const adSpend = gmv / payRoiInput;
    const total = talentIncome + adSpend;

    const feeRatio = total / gmv;
    const adFeeRatio = adSpend / gmv;
    const talentFeeRatio = talentIncome / gmv;
    const settlementFeeRatio = total / gsv;

    const paymentRoi = gmv / adSpend;
    const netRoi = gsv / adSpend;
    const fullCostRoi = gmv / total;

    const hideGmvCard = returnBlank && targetType === 'gsv';
    const hideGsvCard = returnBlank && targetType !== 'gsv';
    const hideNetRoiCard = returnBlank;

    setCalc({
      gmv: formatMoney(gmv),
      gsv: returnBlank && targetType !== 'gsv' ? '按 0% 假设隐藏' : formatMoney(gsv),
      comm: formatMoney(commission),
      talentIncome: formatMoney(talentIncome),
      ads: formatMoney(adSpend),
      total: formatMoney(total),
      fee: formatPct(feeRatio),
      settleFee: formatPct(settlementFeeRatio),
      adFee: formatPct(adFeeRatio),
      talentFee: formatPct(talentFeeRatio),
      payRoi: paymentRoi.toFixed(2),
      netRoi: returnBlank ? '按 0% 假设隐藏' : netRoi.toFixed(2),
      fullRoi: fullCostRoi.toFixed(2),
      dBooth: formatMoney(boothNum),
      dComm: formatMoney(commission),
      dTalentIncome: formatMoney(talentIncome),
      dAds: formatMoney(adSpend),
      dTotal: formatMoney(total),
      boothRaw: boothNum,
      commRaw: commission,
      adsRaw: adSpend,
      totalRaw: total,
      hideGmv: hideGmvCard,
      hideGsv: hideGsvCard,
      hideNetRoi: hideNetRoiCard,
    });

    if (returnBlank) {
      const msg =
        targetType === 'gsv'
          ? '固定目标 GSV，退货率暂按 0% 估算；已隐藏反推 GMV 和净成交 ROI。'
          : targetType === 'gmv'
          ? '固定目标 GMV，退货率暂按 0% 估算；已隐藏 GSV 和净成交 ROI。'
          : targetType === 'fee_gsv'
          ? '退货率暂按 0% 估算并固定结算综合费比；已隐藏 GSV 和净成交 ROI。'
          : '退货率暂按 0% 估算并固定目标综合费比；已隐藏 GSV 和净成交 ROI。';
      setStatus({ type: 'warn', text: msg });
    } else if (targetType === 'fee_gmv') {
      setStatus({
        type: 'ok',
        text: '固定 GMV口径目标综合费比：修改退货率会重新反推 GMV，以维持目标费比；GSV、佣金及费用随之变化。',
      });
    } else if (targetType === 'fee_gsv') {
      setStatus({
        type: 'ok',
        text: '固定 GSV口径结算综合费比：修改退货率会重新反推 GMV，以维持目标结算费比；GSV、佣金及费用随之变化。',
      });
    } else if (targetType === 'gsv') {
      setStatus({
        type: 'ok',
        text: '固定目标 GSV：修改退货率会反推 GMV，并影响佣金、千川消耗和总营销费用。',
      });
    } else {
      setStatus({
        type: 'ok',
        text: '固定目标 GMV：修改退货率会改变 GSV、佣金、千川消耗和总营销费用。',
      });
    }

    const modeLabel = isFeeTarget ? '按目标费比反推' : '按目标成交额测算';
    lastResultRef.current = {
      mode: modeLabel,
      targetBasis,
      paymentROI: paymentRoi,
      booth: boothNum,
      commissionRate: rateNum * 100,
      returnRate: returnBlank ? '未填写（按0%临时估算）' : returnRate * 100,
      gmv: hideGmvCard ? '按要求隐藏' : gmv,
      gsv: hideGsvCard ? '按要求隐藏' : gsv,
      commission,
      talentIncome,
      adSpend,
      total,
      feeRatio: feeRatio * 100,
      adFeeRatio: adFeeRatio * 100,
      talentFeeRatio: talentFeeRatio * 100,
      settlementFeeRatio: settlementFeeRatio * 100,
      paymentRoiOut: paymentRoi,
      netRoi: hideNetRoiCard ? '按要求隐藏' : netRoi,
      fullCostRoi,
    };
  };

  useEffect(() => {
    calculate();
  }, [payRoi, booth, rate, ret, targetType, targetValue]);

  const handleTargetTypeChange = (newType: TargetType) => {
    const nextKind = newType.startsWith('fee_') ? 'fee' : 'amount';
    const unitChanged =
      lastTargetKindRef.current !== null && lastTargetKindRef.current !== nextKind;
    if (unitChanged) {
      setTargetValue('');
    }
    lastTargetKindRef.current = nextKind;
    setTargetType(newType);

    if (unitChanged) {
      setStatus({
        type: 'warn',
        text: '目标单位已切换，已清空旧数值，请重新输入。',
      });
      const inputEl = document.getElementById('targetValue');
      if (inputEl) inputEl.focus();
    }
  };

  const handleReset = () => {
    setPayRoi('3');
    setBooth('50000');
    setRate('5');
    setRet('20');
    setTargetType('fee_gmv');
    setTargetValue('60');
    lastTargetKindRef.current = 'fee';
    setResetLabel('已恢复示例');
    showToast('已恢复预设示例数据');
    setTimeout(() => {
      setResetLabel('恢复示例数据');
    }, 1100);
  };

  const handleClear = () => {
    setPayRoi('');
    setBooth('');
    setRate('');
    setRet('');
    setTargetValue('');
    setCalc(EMPTY_STATE);
    setClearLabel('已清空');
    showToast('已清空所有输入项');
    setTimeout(() => {
      setClearLabel('清空输入');
    }, 1100);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCsvExport = () => {
    calculate();
    if (!lastResultRef.current) {
      showToast('请先输入完整参数以导出计算结果');
      return;
    }
    const res = lastResultRef.current;
    const rows = [
      ['项目', '结果'],
      ['计算模式', res.mode],
      ['目标输入口径', res.targetBasis],
      ['目标值', targetValue.trim()],
      ['支付 ROI（支付GMV/千川消耗）', res.paymentROI],
      ['达人坑位费（元）', res.booth],
      ['达人佣金比例（%）', res.commissionRate],
      ['退货率（%）', res.returnRate],
      ['GMV（退款前）', res.gmv],
      ['GSV（退款后）', res.gsv],
      ['达人佣金（GSV口径，元）', res.commission],
      ['达人总收益（坑位费+GSV口径佣金，元）', res.talentIncome],
      ['千川广告消耗（元）', res.adSpend],
      ['总营销费用（元）', res.total],
      ['广告费比（%）', res.adFeeRatio],
      ['达人费比（%）', res.talentFeeRatio],
      ['综合费比（GMV口径，%）', res.feeRatio],
      ['结算综合费比（GSV口径，%）', res.settlementFeeRatio],
      ['支付 ROI', res.paymentRoiOut],
      ['净成交 ROI', res.netRoi],
      ['全成本 ROI', res.fullCostRoi],
    ];

    const csvContent =
      '\uFEFF' +
      rows
        .map((row) =>
          row.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(',')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '商务费比计算结果.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('已成功导出 CSV 报表');
  };

  const handleDownloadHtml = () => {
    const a = document.createElement('a');
    a.href = './商务费比计算器_三种ROI专业版.html';
    a.download = '商务费比计算器_三种ROI专业版.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('正在下载离线单机版 HTML 文件...');
  };

  const handleDownloadZip = () => {
    const a = document.createElement('a');
    a.href = 'https://github.com/xucy217429-ops/shangwufeibi-calculator/archive/refs/heads/main.zip';
    a.download = '商务费比计算器_完整项目包.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('正在下载完整项目包 (源码 + dist构建产物)...');
  };

  const currentDesc = DESCRIPTIONS[targetType];

  // Proportions for breakdown bar
  const boothPct = calc.totalRaw > 0 ? (calc.boothRaw / calc.totalRaw) * 100 : 0;
  const commPct = calc.totalRaw > 0 ? (calc.commRaw / calc.totalRaw) * 100 : 0;
  const adsPct = calc.totalRaw > 0 ? (calc.adsRaw / calc.totalRaw) * 100 : 0;

  return (
    <div className="wrap">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="copy-toast">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Command Deck */}
      <header className="hero">
        <div className="hero-grid-pattern" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-copy">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="tag">
                <span className="tag-dot" />
                商务预算测算工具 <span className="opacity-40">/</span> 4 种计算口径
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="theme-toggle-btn inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-sky-200 transition-all cursor-pointer"
                title={isDark ? '切换至明亮模式' : '切换至暗黑模式'}
              >
                {isDark ? <Sun size={13} /> : <Moon size={13} />}
                <span>{isDark ? '极光暗黑' : '纯白透亮'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadZip}
                className="theme-toggle-btn inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-emerald-400/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition-all cursor-pointer shadow-sm font-medium"
                title="打包下载项目完整工程包（含React源码、构建产物与开发文档）"
              >
                <Download size={13} />
                <span>打包下载项目 (ZIP)</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="theme-toggle-btn inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 transition-all cursor-pointer shadow-sm"
                title="直接下载单机离线版 HTML 文件，本地浏览器即可运行"
              >
                <Download size={13} />
                <span>下载单机版 HTML</span>
              </button>
            </div>
            <h1>
              <Calculator className="w-8 h-8 text-sky-400 shrink-0" />
              商务费比计算器
            </h1>
            <p>
              把投流、达人成本与退款影响放进同一套预算模型。GMV 为退款前成交金额，GSV 为退款后结算金额。
            </p>
            <div className="hero-points">
              <span>
                <CheckCircle2 size={13} className="text-sky-400" />
                实时联动计算
              </span>
              <span>
                <PieChart size={13} className="text-cyan-400" />
                GMV 与 GSV 双口径
              </span>
              <span>
                <Download size={13} className="text-teal-400" />
                一键导出结果
              </span>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-equation">
              <b>GMV</b>
              <i>→</i>
              <b>GSV</b>
              <small>预算 · 成本 · 结算</small>
            </div>
          </div>
        </div>
      </header>

      {/* Main Form & Calculation Engine */}
      <main>
        {/* 01 / 基础参数 */}
        <h2>
          <span className="section-icon-badge">01</span>
          基础参数
        </h2>
        <div className="grid basic-grid">
          <div className="field">
            <label htmlFor="payRoi">
              <span>支付 ROI（支付 GMV ÷ 千川消耗）</span>
            </label>
            <div className="input-container">
              <TrendingUp size={18} className="input-icon-lead" />
              <input
                id="payRoi"
                type="number"
                min="0"
                step="0.01"
                value={payRoi}
                onChange={(e) => setPayRoi(e.target.value)}
                placeholder="请输入支付 ROI"
              />
              <div className="input-stepper-cluster">
                {payRoi.trim() !== '' && (
                  <div className="custom-stepper" role="group" aria-label="微调支付 ROI">
                    <button
                      type="button"
                      tabIndex={-1}
                      className="stepper-btn stepper-btn-up"
                      onClick={() => handleStep('payRoi', 0.1, true, 0)}
                      aria-label="增加 0.1"
                      title="微调增加 (+0.1)"
                    >
                      <ChevronUp size={9} strokeWidth={2.8} />
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className="stepper-btn stepper-btn-down"
                      onClick={() => handleStep('payRoi', 0.1, false, 0)}
                      aria-label="减少 0.1"
                      title="微调减少 (-0.1)"
                    >
                      <ChevronDown size={9} strokeWidth={2.8} />
                    </button>
                  </div>
                )}
                <span className="input-suffix-badge">x</span>
              </div>
            </div>
            <span className="hint">广告投放口径；用于反推千川消耗</span>
          </div>

          <div className="field">
            <label htmlFor="booth">
              <span>达人坑位费（元）</span>
            </label>
            <div className="input-container">
              <DollarSign size={18} className="input-icon-lead" />
              <input
                id="booth"
                type="number"
                min="0"
                step="0.01"
                value={booth}
                onChange={(e) => setBooth(e.target.value)}
                placeholder="请输入达人坑位费"
              />
              <div className="input-stepper-cluster">
                {booth.trim() !== '' && (
                  <div className="custom-stepper" role="group" aria-label="微调坑位费">
                    <button
                      type="button"
                      tabIndex={-1}
                      className="stepper-btn stepper-btn-up"
                      onClick={() => handleStep('booth', 5000, true, 0)}
                      aria-label="增加 5,000"
                      title="微调增加 (+5,000)"
                    >
                      <ChevronUp size={9} strokeWidth={2.8} />
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className="stepper-btn stepper-btn-down"
                      onClick={() => handleStep('booth', 5000, false, 0)}
                      aria-label="减少 5,000"
                      title="微调减少 (-5,000)"
                    >
                      <ChevronDown size={9} strokeWidth={2.8} />
                    </button>
                  </div>
                )}
                <span className="input-suffix-badge">¥</span>
              </div>
            </div>
            <span className="hint">主播/达人固定出场费，直接计入营销成本</span>
          </div>

          <div className="field">
            <label htmlFor="rate">
              <span>达人佣金比例（%）</span>
            </label>
            <div className="input-container">
              <Percent size={18} className="input-icon-lead" />
              <input
                id="rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="请输入达人佣金比例"
              />
              <div className="input-stepper-cluster">
                {rate.trim() !== '' && (
                  <div className="custom-stepper" role="group" aria-label="微调佣金比例">
                    <button
                      type="button"
                      tabIndex={-1}
                      className="stepper-btn stepper-btn-up"
                      onClick={() => handleStep('rate', 1, true, 0, 100)}
                      aria-label="增加 1%"
                      title="微调增加 (+1%)"
                    >
                      <ChevronUp size={9} strokeWidth={2.8} />
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className="stepper-btn stepper-btn-down"
                      onClick={() => handleStep('rate', 1, false, 0, 100)}
                      aria-label="减少 1%"
                      title="微调减少 (-1%)"
                    >
                      <ChevronDown size={9} strokeWidth={2.8} />
                    </button>
                  </div>
                )}
                <span className="input-suffix-badge">%</span>
              </div>
            </div>
            <span className="hint">
              佣金比例按百分数输入，例如输入 20 代表 20%；佣金按 GSV × 佣金比例估算
            </span>
          </div>

          <div className="field">
            <label htmlFor="ret">
              <span>退货率（%）</span>
            </label>
            <div className="input-container">
              <RotateCcw size={18} className="input-icon-lead" />
              <input
                id="ret"
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                value={ret}
                onChange={(e) => setRet(e.target.value)}
                placeholder="请输入退货率，可留空"
              />
              <div className="input-stepper-cluster">
                {ret.trim() !== '' && (
                  <div className="custom-stepper" role="group" aria-label="微调退货率">
                    <button
                      type="button"
                      tabIndex={-1}
                      className="stepper-btn stepper-btn-up"
                      onClick={() => handleStep('ret', 1, true, 0, 99.9)}
                      aria-label="增加 1%"
                      title="微调增加 (+1%)"
                    >
                      <ChevronUp size={9} strokeWidth={2.8} />
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      className="stepper-btn stepper-btn-down"
                      onClick={() => handleStep('ret', 1, false, 0, 99.9)}
                      aria-label="减少 1%"
                      title="微调减少 (-1%)"
                    >
                      <ChevronDown size={9} strokeWidth={2.8} />
                    </button>
                  </div>
                )}
                <span className="input-suffix-badge">%</span>
              </div>
            </div>
            <span className="hint">
              百分比按百分数输入，例如输入 20 代表 20%；GSV = GMV ×（1 − 退货率）
            </span>
          </div>
        </div>

        {/* 02 / 目标参数 */}
        <h2>
          <span className="section-icon-badge">02</span>
          目标参数
        </h2>
        <div className="target-panel">
          {/* Top: 目标类型选择 (Ceremonial Interactive Cards) */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="targetType" className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>目标类型选择</span>
                <span className="text-[11.5px] font-normal text-slate-500 dark:text-slate-400">（选择一种目标测算口径，系统自动反推其余业务指标）</span>
              </label>
              {/* Accessible hidden select to ensure native DOM id="targetType" exists with exact options */}
              <select
                id="targetType"
                className="sr-only"
                value={targetType}
                onChange={(e) => handleTargetTypeChange(e.target.value as TargetType)}
                aria-label="目标类型"
              >
                <option value="fee_gmv">按目标综合费比反推（GMV口径）</option>
                <option value="fee_gsv">按结算综合费比反推（GSV口径）</option>
                <option value="gmv">按目标 GMV 测算</option>
                <option value="gsv">按目标 GSV 测算</option>
              </select>
            </div>

            <div className="target-cards-grid">
              {MODE_CARDS.map((card) => {
                const isActive = targetType === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`target-mode-card ${isActive ? 'active' : ''}`}
                    onClick={() => handleTargetTypeChange(card.id)}
                  >
                    <div className="target-card-header">
                      <span className="target-card-badge">
                        {card.badge}
                      </span>
                      <div className="target-card-radio">
                        <div className="target-card-radio-inner" />
                      </div>
                    </div>
                    <div>
                      <div className="target-card-title flex items-center gap-1.5">
                        {card.iconName === 'percent' && <Percent size={14} className="shrink-0 text-sky-400" />}
                        {card.iconName === 'pie' && <PieChart size={14} className="shrink-0 text-indigo-400" />}
                        {card.iconName === 'trending' && <TrendingUp size={14} className="shrink-0 text-emerald-400" />}
                        {card.iconName === 'dollar' && <DollarSign size={14} className="shrink-0 text-amber-400" />}
                        <span>{card.title}</span>
                      </div>
                      <div className="target-card-sub">{card.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom 2 columns: Left is the target value input, Right is the active formula preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            <div className="field">
              <label id="targetValueLabel" htmlFor="targetValue">
                <span>{currentDesc.label}</span>
              </label>
              <div className="input-container">
                <Target size={18} className="input-icon-lead" />
                <input
                  id="targetValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={currentDesc.placeholder}
                />
                <div className="input-stepper-cluster">
                  {targetValue.trim() !== '' && (
                    <div className="custom-stepper" role="group" aria-label="微调目标值">
                      <button
                        type="button"
                        tabIndex={-1}
                        className="stepper-btn stepper-btn-up"
                        onClick={() =>
                          handleStep(
                            'targetValue',
                            targetType === 'fee_gmv' || targetType === 'fee_gsv' ? 1 : 10000,
                            true,
                            0,
                            targetType === 'fee_gmv' || targetType === 'fee_gsv' ? 100 : undefined
                          )
                        }
                        aria-label="增加目标数值"
                        title={
                          targetType === 'fee_gmv' || targetType === 'fee_gsv'
                            ? '微调增加 (+1%)'
                            : '微调增加 (+10,000元)'
                        }
                      >
                        <ChevronUp size={9} strokeWidth={2.8} />
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        className="stepper-btn stepper-btn-down"
                        onClick={() =>
                          handleStep(
                            'targetValue',
                            targetType === 'fee_gmv' || targetType === 'fee_gsv' ? 1 : 10000,
                            false,
                            0,
                            targetType === 'fee_gmv' || targetType === 'fee_gsv' ? 100 : undefined
                          )
                        }
                        aria-label="减少目标数值"
                        title={
                          targetType === 'fee_gmv' || targetType === 'fee_gsv'
                            ? '微调减少 (-1%)'
                            : '微调减少 (-10,000元)'
                        }
                      >
                        <ChevronDown size={9} strokeWidth={2.8} />
                      </button>
                    </div>
                  )}
                  <span className="input-suffix-badge">{currentDesc.unit}</span>
                </div>
              </div>
              <span className="hint" id="targetHint">
                {currentDesc.hint}
              </span>
            </div>

            <div className="target-formula-card">
              <div className="formula-card-header">
                <span className="formula-badge">当前核心测算公式</span>
                <span className="formula-basis">{MODE_TABS.find((t) => t.id === targetType)?.name}</span>
              </div>
              <div className="formula-card-body">
                {currentDesc.formula}
              </div>
            </div>
          </div>
        </div>

        {/* Status Notification Banner */}
        <div
          id="status"
          className={`status ${status.type}`}
          role="status"
          aria-live="polite"
          style={{ display: status.text ? 'flex' : 'none' }}
        >
          {status.type === 'error' && <AlertTriangle size={18} className="shrink-0 text-red-500" />}
          {status.type === 'warn' && <Info size={18} className="shrink-0 text-amber-500" />}
          {status.type === 'ok' && <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />}
          <span>{status.text}</span>
        </div>

        {/* 03 / 自动计算结果 */}
        <h2>
          <span className="section-icon-badge">03</span>
          自动计算结果
        </h2>
        <div className="results">
          {/* Group 1: 成交金额 */}
          <div className="result-group">
            <span className="result-group-indicator">成交金额</span>
            <span className="text-[11px] font-normal lowercase tracking-normal opacity-60">gmv / gsv volume</span>
          </div>
          
          <div
            className={`card primary ${calc.hideGmv ? 'hidden' : ''}`}
            id="gmvCard"
            onClick={() => copyToClipboard(calc.gmv, 'GMV')}
            title="点击复制金额"
          >
            <div className="name">
              <span>GMV（退款前支付成交金额）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oGmv">{calc.gmv}</div>
            <div className="sub">支付 GMV 口径</div>
          </div>

          <div
            className={`card primary ${calc.hideGsv ? 'hidden' : ''}`}
            id="gsvCard"
            onClick={() => copyToClipboard(calc.gsv, 'GSV')}
            title="点击复制金额"
          >
            <div className="name">
              <span>GSV（退款后结算成交金额）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oGsv">{calc.gsv}</div>
            <div className="sub">GMV ×（1 − 退货率）</div>
          </div>

          {/* Group 2: 费用金额 */}
          <div className="result-group">
            <span className="result-group-indicator">费用金额</span>
            <span className="text-[11px] font-normal lowercase tracking-normal opacity-60">marketing costs</span>
          </div>

          <div
            className="card primary"
            onClick={() => copyToClipboard(calc.talentIncome, '达人总收益')}
            title="点击复制金额"
          >
            <div className="name">
              <span>达人总收益（坑位费 + GSV口径佣金）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oTalentIncome">{calc.talentIncome}</div>
            <div className="sub">达人坑位费 + GSV口径佣金</div>
          </div>

          <div
            className="card"
            onClick={() => copyToClipboard(calc.comm, '达人佣金金额')}
            title="点击复制金额"
          >
            <div className="name">
              <span>达人佣金金额（GSV口径预算估算）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oComm">{calc.comm}</div>
            <div className="sub">GSV × 佣金比例</div>
          </div>

          <div
            className="card"
            onClick={() => copyToClipboard(calc.ads, '千川广告消耗')}
            title="点击复制金额"
          >
            <div className="name">
              <span>千川广告消耗</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oAds">{calc.ads}</div>
            <div className="sub">GMV ÷ 支付 ROI</div>
          </div>

          <div
            className="card"
            onClick={() => copyToClipboard(calc.total, '总营销费用')}
            title="点击复制金额"
          >
            <div className="name">
              <span>总营销费用</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oTotal">{calc.total}</div>
            <div className="sub">坑位费 + 达人佣金 + 千川消耗</div>
          </div>

          {/* Group 3: 费比 */}
          <div className="result-group">
            <span className="result-group-indicator">费比</span>
            <span className="text-[11px] font-normal lowercase tracking-normal opacity-60">fee ratios</span>
          </div>

          <div
            className="card primary"
            onClick={() => copyToClipboard(calc.fee, '综合费比')}
            title="点击复制费比"
          >
            <div className="name">
              <span>综合费比（GMV口径）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oFee">{calc.fee}</div>
            <div className="sub">总营销费用 ÷ 支付 GMV</div>
          </div>

          <div
            className="card primary"
            onClick={() => copyToClipboard(calc.settleFee, '结算综合费比')}
            title="点击复制费比"
          >
            <div className="name">
              <span>结算综合费比（GSV口径）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oSettleFee">{calc.settleFee}</div>
            <div className="sub">总营销费用 ÷ 结算 GMV（GSV）</div>
          </div>

          <div
            className="card"
            onClick={() => copyToClipboard(calc.adFee, '广告费比')}
            title="点击复制费比"
          >
            <div className="name">
              <span>广告费比（投流费比）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oAdFee">{calc.adFee}</div>
            <div className="sub">千川消耗 ÷ 支付 GMV，不含佣金和坑位费</div>
          </div>

          <div
            className="card"
            onClick={() => copyToClipboard(calc.talentFee, '达人费比')}
            title="点击复制费比"
          >
            <div className="name">
              <span>达人费比（佣金 + 坑位费）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oTalentFee">{calc.talentFee}</div>
            <div className="sub">（坑位费 + 达人佣金）÷ 支付 GMV，不含投流</div>
          </div>

          {/* Group 4: ROI */}
          <div className="result-group">
            <span className="result-group-indicator">ROI</span>
            <span className="text-[11px] font-normal lowercase tracking-normal opacity-60">return on investment</span>
          </div>

          <div
            className="card primary"
            onClick={() => copyToClipboard(calc.payRoi, '支付 ROI')}
            title="点击复制 ROI"
          >
            <div className="name">
              <span>支付 ROI（广告 ROI）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oPayRoi">{calc.payRoi}</div>
            <div className="sub">支付 GMV ÷ 千川消耗</div>
          </div>

          <div
            className={`card primary ${calc.hideNetRoi ? 'hidden' : ''}`}
            id="netRoiCard"
            onClick={() => copyToClipboard(calc.netRoi, '净成交 ROI')}
            title="点击复制 ROI"
          >
            <div className="name">
              <span>净成交 ROI（结算 ROI / GSV ROI）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oNetRoi">{calc.netRoi}</div>
            <div className="sub">GSV ÷ 千川消耗</div>
          </div>

          <div
            className="card primary"
            onClick={() => copyToClipboard(calc.fullRoi, '全成本 ROI')}
            title="点击复制 ROI"
          >
            <div className="name">
              <span>全成本 ROI（综合 ROI）</span>
              <span className="card-copy-hint"><Copy size={12} />复制</span>
            </div>
            <div className="value" id="oFullRoi">{calc.fullRoi}</div>
            <div className="sub">GMV ÷ 总营销费用</div>
          </div>
        </div>

        {/* 04 / 营销费用明细 */}
        <div className="detail">
          <h3>
            <span>04 / 营销费用明细</span>
            <span className="text-xs font-normal text-muted">费用构成可视化分析</span>
          </h3>

          {/* Visual Stacked Cost Proportions Bar */}
          {calc.totalRaw > 0 && (
            <div className="expense-breakdown-bar">
              <div className="breakdown-bar-track" title="费用占比分布条">
                <div
                  className="bar-segment bar-booth"
                  style={{ width: `${boothPct}%` }}
                />
                <div
                  className="bar-segment bar-comm"
                  style={{ width: `${commPct}%` }}
                />
                <div
                  className="bar-segment bar-ads"
                  style={{ width: `${adsPct}%` }}
                />
              </div>
              <div className="breakdown-bar-legend">
                <div className="legend-item">
                  <span className="legend-dot bg-amber-500" />
                  <span>坑位费 {boothPct.toFixed(1)}%</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot bg-purple-500" />
                  <span>佣金 {commPct.toFixed(1)}%</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot bg-sky-500" />
                  <span>千川广告 {adsPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          <div className="row">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              达人坑位费
            </span>
            <strong id="dBooth">{calc.dBooth}</strong>
          </div>
          <div className="row">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              达人佣金
            </span>
            <strong id="dComm">{calc.dComm}</strong>
          </div>
          <div className="row">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              达人总收益（坑位费 + 佣金）
            </span>
            <strong id="dTalentIncome">{calc.dTalentIncome}</strong>
          </div>
          <div className="row">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              千川广告消耗
            </span>
            <strong id="dAds">{calc.dAds}</strong>
          </div>
          <div className="row font-semibold bg-sky-500/5">
            <span className="flex items-center gap-2 text-sky-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              总营销费用
            </span>
            <strong id="dTotal" className="text-sky-400">{calc.dTotal}</strong>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="actions">
          <button id="reset" type="button" onClick={handleReset}>
            <RotateCw size={15} />
            <span>{resetLabel}</span>
          </button>
          <button id="clear" type="button" onClick={handleClear}>
            <Trash2 size={15} />
            <span>{clearLabel}</span>
          </button>
          <button id="print" type="button" onClick={handlePrint}>
            <Printer size={15} />
            <span>打印 / 保存 PDF</span>
          </button>
          <button id="downloadZip" type="button" onClick={handleDownloadZip} className="border-emerald-500/40 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/10">
            <Download size={15} />
            <span>下载项目包 (ZIP)</span>
          </button>
          <button id="downloadHtml" type="button" onClick={handleDownloadHtml} className="border-sky-500/30 text-sky-400 hover:border-sky-400">
            <Download size={15} />
            <span>下载单机 HTML</span>
          </button>
          <button className="primary" id="csv" type="button" onClick={handleCsvExport}>
            <Download size={16} />
            <span>导出计算结果 CSV</span>
            <ArrowUpRight size={16} className="button-arrow" />
          </button>
        </div>

        {/* 05 / 计算口径与公式 */}
        <div className="formula">
          <h3>
            <Calculator size={17} className="text-sky-400" />
            05 / 计算口径与公式
          </h3>
          <div className="roi-defs">
            <div className="roi-def">
              <b>支付 ROI（广告 ROI）</b>
              <span>
                支付 GMV ÷ 千川广告消耗
                <br />
                只衡量广告投放产出，不扣退款及达人费用
              </span>
            </div>
            <div className="roi-def">
              <b>净成交 ROI（结算 ROI）</b>
              <span>
                GSV（扣退款）÷ 千川广告消耗
                <br />
                衡量扣退款后的广告产出
              </span>
            </div>
            <div className="roi-def">
              <b>全成本 ROI（综合 ROI）</b>
              <span>
                GMV ÷（千川消耗 + 坑位费 + 达人佣金）
                <br />
                衡量达人专场全营销成本效率
              </span>
            </div>
          </div>
          <p>
            <b>四种费比自动计算：</b>广告费比 = 千川消耗 ÷ 支付 GMV；达人费比 =（坑位费 + 达人佣金）÷ 支付 GMV；综合费比（GMV口径）= 总营销费用 ÷ 支付 GMV；结算综合费比（GSV口径）= 总营销费用 ÷ 退款后结算 GMV（GSV）。
          </p>
          <p>
            <b>综合费比（GMV口径）</b> = 总营销费用 ÷ GMV；<b>全成本 ROI</b> = GMV ÷ 总营销费用。两者互为倒数。退款率越高，结算综合费比通常越高。
          </p>
          <p>
            <b>净成交 ROI</b> = 支付 ROI ×（1 − 退货率）。净成交 ROI 与支付 ROI 的差异来自退款。
          </p>
          <p id="formulaDescription">
            <b>当前计算公式：</b>
            {currentDesc.formula}
            <br />
            达人佣金 = GSV × 佣金比例；千川消耗 = GMV ÷ 支付 ROI；总营销费用 = 坑位费 + 达人佣金 + 千川消耗。
          </p>
        </div>

        {/* 重要口径说明 */}
        <div className="note">
          <div className="font-bold text-sky-400 mb-3 flex items-center gap-2">
            <Info size={16} />
            重要口径说明：
          </div>
          <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
            <li>
              支付 ROI = 支付 GMV ÷ 千川消耗；净成交 ROI = 退款后 GSV ÷ 千川消耗；全成本 ROI = GMV ÷（千川消耗 + 坑位费 + 达人佣金）。
            </li>
            <li>
              模式一按目标费比口径反推：输入 GMV口径目标综合费比时，修改退货率会重新反推 GMV，以维持目标费比，并影响 GSV、GSV口径佣金、千川消耗和总营销费用；输入 GSV口径结算综合费比时，修改退货率会重新反推 GMV，以维持目标结算费比，同样会影响 GSV、佣金、千川消耗和总营销费用。
            </li>
            <li>
              模式二固定输入 GSV 时，修改退货率会反推改变 GMV，并影响按 GSV 估算的佣金、千川消耗和总营销费用；固定输入 GMV 时，GMV不变，GSV、佣金、千川消耗和总营销费用会随退货率变化。
            </li>
            <li>
              退货率留空时，其他预算暂按 0% 退货率估算；模式一隐藏 GSV 和净成交 ROI，模式二隐藏 GMV 和净成交 ROI。
            </li>
            <li>
              佣金暂按 GSV × 合同佣金比例估算；实际佣金结算基数、退款佣金追回及结算周期，以平台实际账单为准。本工具是品牌方预算测算模型，不代表抖音官方结算公式。
            </li>
          </ol>
        </div>

        <p className="foot">
          单机 HTML 文件，无需安装、无需联网。下载后使用 Chrome 或 Edge 打开即可。
        </p>
      </main>
    </div>
  );
}

