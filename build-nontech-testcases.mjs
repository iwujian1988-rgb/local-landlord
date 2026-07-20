// 生成"非技术人员版"测试用例 Excel
// 跑法: node build-nontech-testcases.mjs
import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs';

const outPath = path.resolve('非技术人员测试用例.xlsx');

const wb = new ExcelJS.Workbook();
wb.creator = '本地房东团队';
wb.created = new Date();

// ========== 样式预设 ==========
const C = {
  navy:   'FF17324D',
  teal:   'FF0F766E',
  pale:   'FFE8F3F1',
  gold:   'FFD6A84B',
  light:  'FFFBF3DF',
  blueL:  'FFEAF1F8',
  grayL:  'FFF4F6F8',
  red:    'FFB42318',
  green:  'FF16A34A',
  white:  'FFFFFFFF',
  textDk: 'FF1F2937',
  border: 'FFD1D5DB',
};

const thinBorder = {
  top:    { style: 'thin', color: { argb: C.border } },
  left:   { style: 'thin', color: { argb: C.border } },
  bottom: { style: 'thin', color: { argb: C.border } },
  right:  { style: 'thin', color: { argb: C.border } },
};

// ========== Sheet 1: 说明 ==========
const sIntro = wb.addWorksheet('使用说明', {
  properties: { defaultRowHeight: 24 },
  pageSetup: { paperSize: 9, orientation: 'portrait' },
});
sIntro.views = [{ showGridLines: false }];
sIntro.columns = [{ width: 22 }, { width: 80 }];

const introRows = [
  ['本地房东 · 核心功能测试用例（小白版）', ''],
  ['', ''],
  ['谁来看这份文档', '产品、运营、客服、外部体验官，不需要懂代码。'],
  ['测试目标', '照着点一遍，确认主要功能能跑通。共 18 个场景约 130 步，预计 35-45 分钟跑完。'],
  ['怎么判断通过', '每一步都给了"应该看到"——对得上就在"测试结果"列选 ✅通过，对不上选 ❌不通过。'],
  ['', ''],
  ['测试前准备', ''],
  ['测试环境', '微信开发者工具 / 体验版小程序（找开发要二维码）'],
  ['测试账号', '找开发要一个全新测试号，避免和老数据混'],
  ['要准备的东西', '3 张随便的图片（房子外观、收款码、合同）放在桌面备用'],
  ['', ''],
  ['勾选方式', '在"测试结果"列点单元格，会弹出下拉框，选 ✅通过 / ❌不通过 / ⏳未测'],
  ['备注怎么填', '不通过时，在"实际看到 / 现象"列用大白话写一句，最好截图'],
  ['', ''],
  ['🟢 通过', '屏幕显示和"应该看到"一致'],
  ['🔴 不通过', '屏幕显示不一样 / 卡住 / 报错 / 闪退'],
  ['', ''],
  ['总判定', '在"总体评估"Sheet 看汇总。10/10 = 可发真实用户；第六步必过。'],
];

introRows.forEach(([a, b], i) => {
  const r = sIntro.addRow([a, b]);
  if (i === 0) {
    sIntro.mergeCells(`A${i + 1}:B${i + 1}`);
    const cell = sIntro.getCell(`A${i + 1}`);
    cell.value = a;
    cell.font = { bold: true, size: 18, color: { argb: C.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    r.height = 38;
    return;
  }
  const cellA = sIntro.getCell(`A${i + 1}`);
  const cellB = sIntro.getCell(`B${i + 1}`);
  cellA.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  cellB.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  if (a && !b) {
    // 小节标题
    cellA.font = { bold: true, size: 13, color: { argb: C.teal } };
  } else {
    cellA.font = { bold: true, size: 11, color: { argb: C.textDk } };
    cellB.font = { size: 11, color: { argb: C.textDk } };
  }
});

// ========== Sheet 2: 测试用例 ==========
const s = wb.addWorksheet('测试用例', {
  properties: { defaultRowHeight: 38 },
  pageSetup: { paperSize: 9, orientation: 'landscape', fitToWidth: 1 },
});
s.views = [{ showGridLines: false, freeze: 'A4' }];

s.columns = [
  { width: 8 },   // A 场景
  { width: 6 },   // B #
  { width: 28 },  // C 你做什么
  { width: 50 },  // D 应该看到
  { width: 14 },  // E 测试结果 (下拉)
  { width: 30 },  // F 实际看到 / 现象
];

// --- 标题行 ---
s.mergeCells('A1:F1');
const title = s.getCell('A1');
title.value = '本地房东 · 核心功能测试用例（18 场景 / 130+ 步 / 35-45 分钟）';
title.font = { bold: true, size: 16, color: { argb: C.white } };
title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
title.alignment = { vertical: 'middle', horizontal: 'center' };
s.getRow(1).height = 34;

// --- 副标题 ---
s.mergeCells('A2:F2');
const sub = s.getCell('A2');
sub.value = '操作要照顺序来；每一步对得上就选 ✅，对不上选 ❌ 并在右边写现象';
sub.font = { italic: true, size: 10, color: { argb: C.textDk } };
sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pale } };
sub.alignment = { vertical: 'middle', horizontal: 'center' };
s.getRow(2).height = 22;

// --- 表头 ---
const headerRow = ['场景', '步骤', '你做什么', '✅ 应该看到', '测试结果', '实际看到 / 现象'];
headerRow.forEach((h, i) => {
  const c = s.getCell(3, i + 1);
  c.value = h;
  c.font = { bold: true, size: 11, color: { argb: C.white } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.teal } };
  c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  c.border = thinBorder;
});
s.getRow(3).height = 28;

// --- 用例数据 ---
const data = [
  ['一、启动 + 登录', [
    ['确认微信是登录状态', '打开微信能看到聊天列表，没卡在登录页'],
    ['打开"本地房东"小程序', '进入小程序，看到首页或欢迎页（不能是黑屏/白屏）'],
    ['如果是首次，点"开始使用"按钮', '直接进入主页面，不需要输密码、不需要授权弹窗卡住'],
    ['看底部导航栏', '有 4 个 Tab：首页、房间、收租、我的（图标 + 文字都要清晰）'],
    ['看顶部标题', '显示"本地房东"或当前页面名（不能是空白或"undefined"）'],
  ]],
  ['二、添加第一套房源', [
    ['在首页找"添加第一套房源"按钮', '能找到，按钮颜色清晰，不是灰色禁用状态'],
    ['点这个按钮', '进入"添加房源"页面，标题在顶部显示'],
    ['点"拍一张房子外观"区域', '弹出底部小窗，让选"拍照 / 从相册选 / 取消"'],
    ['选"从相册选"，挑一张图', '图片显示在页面上方，下方出现"重新拍摄"按钮'],
    ['再点"重新拍摄"，换一张图', '旧图被替换成新图'],
    ['房源名称：留空，直接点"保存"', '❌ 应弹出错误"请输入房源名称"（不通过算正常）'],
    ['房源名称输入：测试楼A', '输入框出现这 4 个字，无乱码'],
    ['详细地址输入：测试路1号', '输入正常，无卡顿'],
    ['备注输入：6 层楼', '输入正常（备注是选填，不填也行）'],
    ['点"保存"按钮', '顶部弹出绿色提示"房源已添加"，紧接着弹窗问"要现在添加房间吗？"'],
  ]],
  ['三、添加第一个房间', [
    ['上一节弹窗点"现在添加"', '进入添加房间页面，标题"填写房间信息"'],
    ['房间名称：留空，点"保存"', '❌ 应弹"请输入房间名称"'],
    ['房间名称输入：101', '输入正常'],
    ['每月租金：留空，点"保存"', '❌ 应弹"请输入有效租金"'],
    ['每月租金输入：0，点"保存"', '❌ 应弹"请输入有效租金"（0 不算有效）'],
    ['每月租金输入：2500', '输入正常，能看到"元"后缀'],
    ['房间状态保持默认"空着"', '"空着"按钮是高亮/选中样式'],
    ['点开"更多信息（可选）"', '展开更多输入框：押金、面积、楼层、朝向、设施、备注'],
    ['押金输入：5000，面积输入：25 平米，朝向选：朝南', '三个字段都正常输入'],
    ['勾选"有空调"和"有独卫"', '两个标签都变成高亮选中态'],
    ['备注输入：带阳台', '输入正常'],
    ['点"保存"', '顶部弹"房间已保存"，然后弹窗"要现在登记租客吗？"'],
  ]],
  ['四、登记一个租客', [
    ['上一节弹窗点"现在登记"', '进入"登记租客"页面'],
    ['看顶部关联房间', '显示 101（自动带过来，不用手填）'],
    ['租客姓名：留空，点"保存"', '❌ 应弹"请输入租客姓名"'],
    ['租客姓名输入：王先生', '输入正常'],
    ['租客电话：留空，点"保存"', '❌ 应弹"请输入租客电话"'],
    ['租客电话输入：13812345678', '输入正常，11 位数字'],
    ['入住时间：点日期框', '弹出日期滚轮（年月日三列）'],
    ['入住时间选：今天日期', '选好后页面显示 YYYY-MM-DD 格式'],
    ['合同到期选：一年后的今天', '同样弹出滚轮，选好后显示日期'],
    ['每月收租日：点下拉', '出现 1-31 号 + 月底 选项'],
    ['每月收租日选：15号', '显示"15号"'],
    ['押金输入：5000', '输入正常（如果房间已填过押金，这里应自动带出）'],
    ['点"保存"', '弹"租客信息已保存"，自动返回到房间详情或首页'],
  ]],
  ['五、首页信息核对', [
    ['回到首页（点底部"首页"）', '看到刚加的"测试楼A"卡片'],
    ['看 101 房间卡片核心信息', '显示：房间号 101、租客"王先生"、状态"已出租"、应收 2500'],
    ['看卡片快捷按钮', '"发给租客""登记租客""发账单""收款码"等按钮齐全'],
    ['看首页统计区', '显示本月应收 / 已收 / 欠收数字（数字不能是 ??? 或 NaN）'],
    ['看今日待办区', '如果今天是收租日，能看到提醒；否则显示"暂无待办"或类似空态'],
  ]],
  ['六、发账单 + 标记已收 ⭐ 核心', [
    ['首页点房间 101', '进入房间详情页，能看到租客名和房间信息'],
    ['找"发账单"按钮点一下', '进入"通知王先生交租"页面'],
    ['看第一步费用列表', '房租显示 2500，其他费用如有也显示'],
    ['尝试改一个费用金额（如水费 50→80）', '输入框可编辑，合计金额同步更新'],
    ['看底部合计金额', '显示所有费用之和，数字正确'],
    ['第二步"上传账单照片"：选一张图', '图片显示在该步骤区域（也可以跳过此步）'],
    ['第三步点"复制文字"按钮', '弹"文字已复制，可以发给租客了"，剪贴板有内容'],
    ['点底部"我已收到钱"按钮', '弹出确认框"确认标记为已收？"'],
    ['确认', '弹"已标记为已收"，自动返回房间详情；房间状态显示"已收"或类似'],
  ]],
  ['七、设置收款码', [
    ['房间详情页找"收款码"按钮', '进入"我的收款码"页面'],
    ['看页面', '列出三种类型：微信支付、支付宝、银行卡'],
    ['微信支付下点"上传"', '弹出选图（拍照/相册）'],
    ['选一张图片', '显示收款码缩略图，旁边有"已上传"标签'],
    ['点"设为默认"', '该类型出现"默认"标记，其他类型的"默认"会被取消'],
    ['收款人姓名输入：王房东', '输入正常'],
    ['收款说明输入：付款后请微信告诉我', '输入正常'],
    ['点"保存"', '弹"设置已保存"，自动返回上一页'],
    ['重新进入收款码页', '刚才上传的图、默认标记、姓名、说明都还在（不丢）'],
  ]],
  ['八、收租列表（底部 Tab）', [
    ['点底部"收租"Tab', '进入收租列表页'],
    ['看分组标题', '至少能看到 4 个分组：今日应收 / 即将到期 / 已逾期 / 已完成'],
    ['找刚才那笔 2500', '因为已标记已收，应该在"已完成"分组下'],
    ['看每条记录信息', '显示：房间号 101、租客名、金额、收租状态、时间'],
    ['点某条记录进入详情', '能跳转到账单详情或房间详情（不卡死）'],
  ]],
  ['九、收租记录', [
    ['房间详情页找"收租记录"按钮', '进入"101 收租记录"页'],
    ['看列表', '至少有一条记录（刚才 2500 元已收那笔）'],
    ['看记录内容', '类型图标、标题、金额、时间都有；金额对得上 2500'],
    ['点筛选 Tab"账单"', '只显示账单类型记录（不显示其他类型）'],
    ['点筛选 Tab"已收"', '只显示已收的记录'],
  ]],
  ['十、单独收一笔（额外收费）', [
    ['房间详情页找"更多"或"单独收"入口', '进入"单独收一笔钱"页面'],
    ['看顶部房间选择', '默认显示 101（也可下拉切换其他房间）'],
    ['费用类型下拉选：水费', '显示"水费"'],
    ['金额输入：80', '输入正常'],
    ['备注输入：6 月水费', '输入正常'],
    ['点"生成收款通知"', '跳转到付款页面，显示金额 80、收款码（如果设过）'],
    ['返回后看收租记录', '应新增一条水费 80 的记录'],
  ]],
  ['十一、每月要收（费用设置）', [
    ['房间详情页找"更多"→"每月要收"', '进入费用设置页'],
    ['看默认费用项', '房租 2500，默认开关是开的'],
    ['点"添加其他收费项目"', '弹输入框或新行'],
    ['添加"物业费"金额 200', '新增一行，开关默认开'],
    ['添加"网费"金额 100', '再增一行'],
    ['关闭某项的开关（如网费）', '该项变灰/禁用样式'],
    ['返回后再次进入此页', '刚才的数据都还在，状态不变'],
  ]],
  ['十二、合同收据上传', [
    ['房间详情页找"更多"→"合同收据"', '进入合同收据页'],
    ['点"+"或"上传资料"', '弹出选图（拍照/相册）'],
    ['上传一张合同照片', '列表出现新记录'],
    ['看记录字段', '类型（合同/收据）、上传时间、缩略图'],
    ['点筛选 Tab"合同"', '只显示合同类型'],
    ['点某条记录的"删除"按钮', '弹出确认"确认删除？"，确认后该记录消失'],
  ]],
  ['十三、编辑（房源/房间/租客）', [
    ['我的房源 → 点"测试楼A"', '进入房间列表'],
    ['找"编辑房源"入口', '进入编辑房源页，标题"编辑房源"'],
    ['修改名称为：测试楼A（已翻新）', '输入正常'],
    ['点保存', '弹"房源已更新"，返回列表显示新名称'],
    ['房间列表 → 点 101', '进入房间详情'],
    ['找"编辑房间"入口', '进入"编辑房间信息"页'],
    ['修改租金为：2800', '输入正常'],
    ['点保存', '弹"更新成功"或类似提示'],
    ['房间详情找"编辑租客"入口', '进入"编辑租客"页，能改电话'],
  ]],
  ['十四、退租 + 重新出租', [
    ['房间详情 → 找"退租"按钮', '弹出确认框"确认退租？"'],
    ['确认退租', '弹"退租成功"提示'],
    ['看房间状态', '租客信息消失，状态变回"空着"或"未出租"'],
    ['看房间列表/首页', '101 房间显示"空着"标签'],
    ['点"去登记"重新出租', '进入登记租客页'],
    ['填新租客：李女士，电话 13987654321，收租日 10 号', '输入正常'],
    ['保存', '房间状态变回"已出租"，租客显示"李女士"'],
  ]],
  ['十五、收租统计', [
    ['点底部"统计"或在"我的"找统计入口', '进入收租统计页'],
    ['看本月数据', '应收 / 实收 / 欠收三项都有数字显示（不能是 NaN 或 ???）'],
    ['切换到"上月"', '数据切换，显示上月的应收/实收/欠收'],
    ['切换到"本季度"或"近 3 月"', '显示季度汇总，金额是 3 个月之和'],
    ['看图表/进度条（如有）', '收款率有可视化显示，颜色和图例正常'],
  ]],
  ['十六、个人中心', [
    ['点底部"我的"', '显示头像、名字、一排菜单项'],
    ['点"房东资料"', '能查看/编辑姓名、电话'],
    ['点"默认收款码"', '跳转到收款码设置页'],
    ['点"帮助说明"', '显示常见问题列表（FAQ）'],
    ['点"隐私政策"', '显示一段隐私政策文字（不能是空白）'],
    ['点"用户协议"', '显示用户协议文字'],
  ]],
  ['十七、添加第二个房间 / 房源', [
    ['房间列表页 → 点"+"', '进入添加房间页'],
    ['添加 102，租金 2200，状态"空着"', '输入正常'],
    ['保存后弹窗点"稍后再说"', '返回房间列表'],
    ['看列表', '显示 101（已出租）+ 102（空着）'],
    ['看列表顶部统计', '总数 2、空着 1、已租 1（数字对得上）'],
    ['我的房源 → 点"+"加第二套"阳光花园"', '流程跟加第一个房源一样'],
    ['保存后看房源列表', '能看到两个房源卡片'],
  ]],
  ['十八、房间筛选 Tab', [
    ['房间列表页 → 点 Tab"空着"', '只显示空着的房间（如 102）'],
    ['点 Tab"已出租"', '只显示已出租的（如 101）'],
    ['点 Tab"全部"', '显示所有房间'],
    ['看 Tab 切换反应速度', '切换后 1 秒内列表更新完，不卡死'],
  ]],
];

let row = 4;
const resultOptions = ['⏳未测', '✅通过', '❌不通过'];
const scenarioRows = []; // 记录每个场景起止行，给评估表用

data.forEach(([sceneName, steps]) => {
  const startRow = row;
  const stepCount = steps.length;
  // A 列场景名合并
  s.mergeCells(row, 1, row + stepCount - 1, 1);
  const sceneCell = s.getCell(row, 1);
  sceneCell.value = sceneName;
  sceneCell.font = { bold: true, size: 12, color: { argb: C.navy } };
  sceneCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.light } };
  sceneCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, textRotation: 0 };
  sceneCell.border = thinBorder;

  steps.forEach((step, idx) => {
    const r = row;
    s.getCell(r, 2).value = idx + 1;
    s.getCell(r, 3).value = step[0];
    s.getCell(r, 4).value = step[1];
    s.getCell(r, 5).value = '⏳未测'; // 默认未测
    s.getCell(r, 6).value = '';

    // 样式
    s.getCell(r, 2).font = { bold: true, size: 11, color: { argb: C.textDk } };
    s.getCell(r, 2).alignment = { vertical: 'middle', horizontal: 'center' };

    s.getCell(r, 3).font = { size: 11, color: { argb: C.textDk } };
    s.getCell(r, 3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };

    s.getCell(r, 4).font = { size: 11, color: { argb: C.textDk } };
    s.getCell(r, 4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };

    s.getCell(r, 5).font = { bold: true, size: 11 };
    s.getCell(r, 5).alignment = { vertical: 'middle', horizontal: 'center' };

    s.getCell(r, 6).font = { size: 11, color: { argb: C.textDk } };
    s.getCell(r, 6).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };

    // 行底色斑马
    if (idx % 2 === 1) {
      [3, 4, 6].forEach(col => {
        s.getCell(r, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grayL } };
      });
    }
    [2, 3, 4, 5, 6].forEach(col => s.getCell(r, col).border = thinBorder);

    // 下拉验证
    s.getCell(r, 5).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${resultOptions.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'stop',
      error: '请从下拉框选择：未测 / 通过 / 不通过',
      errorTitle: '选错了',
    };

    // 条件格式：✅绿 ❌红
    s.getCell(r, 5).note = undefined;

    row++;
  });

  // 条件格式：基于单元格文本着色（用 formula）
  s.addConditionalFormatting({
    ref: `E${startRow}:E${row - 1}`,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: '✅',
        priority: 1,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } } },
      },
      {
        type: 'containsText',
        operator: 'containsText',
        text: '❌',
        priority: 2,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } } },
      },
      {
        type: 'containsText',
        operator: 'containsText',
        text: '⏳',
        priority: 3,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEF3C7' } } },
      },
    ],
  });

  scenarioRows.push({ name: sceneName, startRow, endRow: row - 1 });
});

// ========== Sheet 3: 总体评估 ==========
const sEval = wb.addWorksheet('总体评估', {
  properties: { defaultRowHeight: 28 },
  pageSetup: { paperSize: 9, orientation: 'landscape' },
});
sEval.views = [{ showGridLines: false }];

sEval.columns = [
  { width: 6 },   // A #
  { width: 32 },  // B 场景
  { width: 16 },  // C 总判定 (下拉)
  { width: 16 },  // D 自动统计通过率
  { width: 40 },  // E 备注
];

sEval.mergeCells('A1:E1');
const eTitle = sEval.getCell('A1');
eTitle.value = '总体评估（每个场景跑完后在这里勾一下）';
eTitle.font = { bold: true, size: 16, color: { argb: C.white } };
eTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
eTitle.alignment = { vertical: 'middle', horizontal: 'center' };
sEval.getRow(1).height = 34;

const eHeader = ['编号', '场景', '总判定', '通过率', '备注'];
eHeader.forEach((h, i) => {
  const c = sEval.getCell(2, i + 1);
  c.value = h;
  c.font = { bold: true, size: 11, color: { argb: C.white } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.teal } };
  c.alignment = { vertical: 'middle', horizontal: 'center' };
  c.border = thinBorder;
});
sEval.getRow(2).height = 26;

const verdictOptions = ['⏳未测', '🟢通过', '🔴不通过'];
scenarioRows.forEach((sc, i) => {
  const r = i + 3;
  sEval.getCell(r, 1).value = i + 1;
  sEval.getCell(r, 2).value = sc.name.replace(/^\d+、/, '');
  sEval.getCell(r, 3).value = '⏳未测';
  // 通过率公式：统计"测试用例"E列对应行中 ✅的占比
  sEval.getCell(r, 4).value = {
    formula:
      `=TEXT(COUNTIF(测试用例!E${sc.startRow}:E${sc.endRow},"*✅*")/(${sc.endRow - sc.startRow + 1}),"0%")`,
  };
  sEval.getCell(r, 5).value = '';

  sEval.getCell(r, 1).font = { bold: true, color: { argb: C.textDk } };
  sEval.getCell(r, 1).alignment = { vertical: 'middle', horizontal: 'center' };
  sEval.getCell(r, 2).font = { size: 11, color: { argb: C.textDk } };
  sEval.getCell(r, 2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sEval.getCell(r, 3).font = { bold: true, size: 12 };
  sEval.getCell(r, 3).alignment = { vertical: 'middle', horizontal: 'center' };
  sEval.getCell(r, 4).font = { size: 11, color: { argb: C.teal } };
  sEval.getCell(r, 4).alignment = { vertical: 'middle', horizontal: 'center' };
  sEval.getCell(r, 5).font = { size: 11, color: { argb: C.textDk } };
  sEval.getCell(r, 5).alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };

  if (i % 2 === 1) {
    [1, 2, 3, 4, 5].forEach(col => {
      sEval.getCell(r, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grayL } };
    });
  }
  [1, 2, 3, 4, 5].forEach(col => sEval.getCell(r, col).border = thinBorder);

  sEval.getCell(r, 3).dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: [`"${verdictOptions.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'stop',
    error: '从未测 / 通过 / 不通过 三选一',
    errorTitle: '选错了',
  };
});

// 评估表条件格式
const evalLastRow = scenarioRows.length + 2;
sEval.addConditionalFormatting({
  ref: `C3:C${evalLastRow}`,
  rules: [
    { type: 'containsText', operator: 'containsText', text: '🟢', priority: 1,
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } } } },
    { type: 'containsText', operator: 'containsText', text: '🔴', priority: 2,
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } } } },
    { type: 'containsText', operator: 'containsText', text: '⏳', priority: 3,
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEF3C7' } } } },
  ],
});

// 总分行
const totalRow = evalLastRow + 1;
sEval.mergeCells(`A${totalRow}:B${totalRow}`);
sEval.getCell(`A${totalRow}`).value = '总通过率';
sEval.getCell(`A${totalRow}`).font = { bold: true, size: 12, color: { argb: C.white } };
sEval.getCell(`A${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
sEval.getCell(`A${totalRow}`).alignment = { vertical: 'middle', horizontal: 'center' };

sEval.getCell(`C${totalRow}`).value = {
  formula: `=IF(COUNTIF(C3:C${evalLastRow},"*🔴*")>0,"🔴有问题",IF(COUNTIF(C3:C${evalLastRow},"*⏳*")>0,"⏳未测完","🟢全部通过"))`,
};
sEval.getCell(`C${totalRow}`).font = { bold: true, size: 12 };
sEval.getCell(`C${totalRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
sEval.getCell(`C${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.light } };

sEval.getCell(`D${totalRow}`).value = {
  formula: `=TEXT(COUNTIF(测试用例!E4:E${row - 1},"*✅*")/(${row - 4}),"0%")`,
};
sEval.getCell(`D${totalRow}`).font = { bold: true, size: 12, color: { argb: C.teal } };
sEval.getCell(`D${totalRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
sEval.getCell(`D${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.light } };

sEval.getCell(`E${totalRow}`).value = '🟢 16+/18 通过（第六步必过）= 可发真实用户 | 🟡 13-15 = 小范围试用 | 🔴 ≤12 或第六步没过 = 返工';
sEval.getCell(`E${totalRow}`).font = { size: 10, color: { argb: C.textDk }, italic: true };
sEval.getCell(`E${totalRow}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
sEval.getCell(`E${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.light } };
sEval.getRow(totalRow).height = 32;

// ========== Sheet 4: 报问题模板 ==========
const sBug = wb.addWorksheet('报问题模板', {
  properties: { defaultRowHeight: 24 },
  pageSetup: { paperSize: 9, orientation: 'portrait' },
});
sBug.views = [{ showGridLines: false }];
sBug.columns = [{ width: 22 }, { width: 70 }];

const bugRows = [
  ['发现问题时，按这个格式记，开发看得懂', ''],
  ['', ''],
  ['在哪个步骤', '例如：第六步 / 第 5 小步'],
  ['你做了什么', '例如：点了"复制文字"按钮'],
  ['你期望看到', '例如：弹出"文字已复制"提示'],
  ['实际看到', '例如：什么都没发生，按钮变灰'],
  ['截图', '（贴一张图在这里）'],
  ['', ''],
  ['示例条目', ''],
  ['在哪个步骤', '六 / 5'],
  ['你做了什么', '点了"复制文字"按钮'],
  ['你期望看到', '弹出"文字已复制，可以发给租客了"'],
  ['实际看到', '点了没反应，按钮颜色没变化'],
];

bugRows.forEach(([a, b], i) => {
  const r = i + 1;
  sBug.getCell(`A${r}`).value = a;
  sBug.getCell(`B${r}`).value = b;
  sBug.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  sBug.getCell(`B${r}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  if (i === 0) {
    sBug.mergeCells(`A${r}:B${r}`);
    sBug.getCell(`A${r}`).font = { bold: true, size: 14, color: { argb: C.white } };
    sBug.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
    sBug.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sBug.getRow(r).height = 32;
  } else if (a && !b) {
    sBug.getCell(`A${r}`).font = { bold: true, size: 12, color: { argb: C.teal } };
  } else {
    sBug.getCell(`A${r}`).font = { bold: true, size: 11, color: { argb: C.textDk } };
    sBug.getCell(`B${r}`).font = { size: 11, color: { argb: C.textDk } };
    if (i >= 9) {
      sBug.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pale } };
      sBug.getCell(`B${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.pale } };
    }
  }
});

// 保存
await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
await wb.xlsx.writeFile(outPath);
console.log(`✅ 已生成: ${outPath}`);
console.log(`   - 4 个 Sheet: 使用说明 / 测试用例 / 总体评估 / 报问题模板`);
console.log(`   - 测试用例: ${row - 4} 步, ${scenarioRows.length} 个场景`);
console.log(`   - 测试结果列已加下拉框: ⏳未测 / ✅通过 / ❌不通过`);
console.log(`   - 评估表自动统计通过率公式`);
