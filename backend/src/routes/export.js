/**
 * Word 文档导出 /api/export
 */
const router = require('express').Router();
const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle, ImageRun, ShadingType, Header, Footer, Media } = require('docx');
const { query, queryOne } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { fail } = require('../utils/helper');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sharp = require('sharp');

const logoPath = path.join(__dirname, '../../assets/logo.jpg');

// 定义字体常量
const FONT_TITLE = '黑体';
const FONT_TABLE_HEADER = '宋体';
const FONT_TABLE_CONTENT = '宋体';

// 部门排序（办公室、教务处、政教处、其他）
const DEPT_ORDER = ['办公室', '教务处', '政教处', '后勤部', '生活中心', '七年级', '八年级', '九年级'];

// 辅助函数：处理多行文本并清理手动序号
function processMultilineItems(dayItems) {
  const processed = [];
  dayItems.forEach(item => {
    const contentStr = item.content || '';
    const respStr = item.responsible || '';
    
    // 按换行符分割，并过滤空行
    const contentLines = contentStr.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const respLines = respStr.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    
    if (contentLines.length === 0) {
      processed.push({ ...item, content: '', responsible: respLines[0] || '——' });
      return;
    }
    
    // 匹配并清理开头的手动序号 (例如 "1. ", "2、", "(1) ", "①")
    const numberRegex = /^(\d+[\.、\)]|[（\(]\d+[）\)]|[①-⑳])\s*/;
    
    contentLines.forEach((cLine, i) => {
      const cleanContent = cLine.replace(numberRegex, '');
      let cleanResp = '——';
      
      if (respLines[i] !== undefined) {
        cleanResp = respLines[i].replace(numberRegex, '');
      } else if (respLines.length === 1) {
        cleanResp = respLines[0].replace(numberRegex, '');
      }
      
      processed.push({
        ...item,
        content: cleanContent,
        responsible: cleanResp
      });
    });
  });
  return processed;
}

function getDeptSortOrder(deptName) {
  const index = DEPT_ORDER.indexOf(deptName);
  return index === -1 ? 999 : index;
}

// 单个部门计划导出（保持原有格式，按条目列表）
function buildDocxFromPlan(plan, items, schoolName, schoolSubName) {
  const { week_number, start_date, end_date, dept_name, title } = plan;

  // 格式化日期范围
  const sd = new Date(start_date);
  const ed = new Date(end_date);
  const dateRange = `${sd.getMonth() + 1}.${sd.getDate()}-${ed.getMonth() + 1}.${ed.getDate()}`;

  // 细边框
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  };

  // 读取 Logo
  let logoData = null;
  if (fs.existsSync(logoPath)) {
    try {
      logoData = fs.readFileSync(logoPath);
    } catch (e) {
      console.error('读取 Logo 失败', e);
    }
  }

  // 标题：学校名称合并为一行
  const headerChildren = [];
  headerChildren.push(
    new Paragraph({
      children: [new TextRun({ text: schoolName + ' ' + (schoolSubName || ''), bold: true, size: 32, color: '000000', font: FONT_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 }
    })
  );

  // 部门名称标题
  headerChildren.push(
    new Paragraph({
      children: [new TextRun({ text: `${dept_name || ''}`, bold: true, size: 36, color: '0891B2', font: FONT_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `第${week_number}周工作行事历（${dateRange}）`, size: 24, color: '333333', font: FONT_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    })
  );

  // 表头行
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: '日期', font: FONT_TABLE_HEADER, size: 20, bold: true })], alignment: AlignmentType.CENTER })],
        borders: tableBorder,
        width: { size: 1404, type: WidthType.DXA },
        shading: { fill: 'E0F2FE', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: '星期', font: FONT_TABLE_HEADER, size: 20, bold: true })], alignment: AlignmentType.CENTER })],
        borders: tableBorder,
        width: { size: 936, type: WidthType.DXA },
        shading: { fill: 'E0F2FE', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: '工作内容', font: FONT_TABLE_HEADER, size: 20, bold: true })], alignment: AlignmentType.CENTER })],
        borders: tableBorder,
        width: { size: 5148, type: WidthType.DXA },
        shading: { fill: 'E0F2FE', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: '负责人（部门）', font: FONT_TABLE_HEADER, size: 20, bold: true })], alignment: AlignmentType.CENTER })],
        borders: tableBorder,
        width: { size: 1872, type: WidthType.DXA },
        shading: { fill: 'E0F2FE', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 }
      })
    ]
  });

  // 2. 数据行
  const processedItems = processMultilineItems(items);
  let currentDay = null;
  let dailyIndex = 0;

  const dataRows = processedItems.map(item => {
    const d = new Date(item.plan_date);
    const dateStr = `${d.getMonth() + 1}月${d.getDate()}日`;

    if (dateStr !== currentDay) {
      currentDay = dateStr;
      dailyIndex = 1;
    } else {
      dailyIndex++;
    }

    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: dateStr, font: FONT_TABLE_CONTENT, size: 20 })], alignment: AlignmentType.CENTER })],
          borders: tableBorder,
          margins: { top: 80, bottom: 80, left: 120, right: 120 }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.weekday || '', font: FONT_TABLE_CONTENT, size: 20 })], alignment: AlignmentType.CENTER })],
          borders: tableBorder,
          margins: { top: 80, bottom: 80, left: 120, right: 120 }
        }),
        new TableCell({
          children: [new Paragraph({ children: [
            new TextRun({ text: `${dailyIndex}. `, font: FONT_TABLE_CONTENT, size: 20 }),
            new TextRun({ text: item.content || '', font: FONT_TABLE_CONTENT, size: 20 })
          ] })],
          borders: tableBorder,
          margins: { top: 80, bottom: 80, left: 120, right: 120 }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: `${dailyIndex}. ${item.responsible || ''}`, font: FONT_TABLE_CONTENT, size: 20 })], alignment: AlignmentType.LEFT })],
          borders: tableBorder,
          margins: { top: 80, bottom: 80, left: 120, right: 120 }
        })
      ]
    });
  });

  const children = [...headerChildren];
  children.push(new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1404, 936, 5148, 1872]
  }));

  if (plan.remark) {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        children: [new TextRun({ text: `备注：${plan.remark}`, size: 20, font: FONT_TABLE_CONTENT })],
        spacing: { before: 200 }
      })
    );
  }

  // Logo 作为页面背景水印（放在页面中下方）
  const footerChildren = [];
  if (logoData) {
    footerChildren.push(new Paragraph({
      children: [new ImageRun({
        data: logoData,
        transformation: { width: 150, height: 150 },
        type: 'jpeg',
        altText: { title: 'Logo', description: 'School Logo', name: 'logo' }
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 0 }
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({ children: [] })
      },
      footers: {
        default: new Footer({ children: footerChildren })
      },
      children
    }]
  });

  return doc;
}

// 生成透明Logo
async function generateTransparentLogo() {
  if (!fs.existsSync(logoPath)) {
    return null;
  }

  try {
    // 使用sharp生成50x50的PNG图片，保持原图比例，透明度40%
    // 先获取图片的raw像素数据
    const { data, info } = await sharp(logoPath)
      .resize(50, 50, { fit: 'inside' }) // 保持原图比例，不裁切
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 调整alpha通道实现40%透明度
    // data是Buffer，每4个字节代表一个像素的RGBA
    const pixelCount = info.width * info.height;
    for (let i = 0; i < pixelCount; i++) {
      const alphaIndex = i * 4 + 3; // alpha通道索引
      if (data[alphaIndex] > 0) { // 如果不是完全透明
        data[alphaIndex] = Math.round(data[alphaIndex] * 0.4); // 设置为40%透明度
      }
    }

    // 将处理后的像素数据转回PNG
    const transparentLogo = await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
      .png()
      .toBuffer();

    return transparentLogo;
  } catch (e) {
    console.error('生成透明 Logo 失败', e);
    return null;
  }
}

// 辅助函数：安全获取本地时区的 YYYY-MM-DD 字符串
function getLocalDateString(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) {
    dateObj = new Date(dateObj);
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 全校汇总导出（新格式：按周日到周六编排，每天一行，同一天多个部门合并）
async function buildWeeklySummary(plans, weekNumber, schoolName, schoolSubName) {
  const plan0 = plans[0];
  const sd = new Date(plan0.start_date);
  const ed = new Date(plan0.end_date);
  const dateRange = `${sd.getMonth() + 1}.${sd.getDate()}-${ed.getMonth() + 1}.${ed.getDate()}`;

  // 细边框
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  };

  // 生成透明Logo（50x50，PNG格式）
  const logoData = await generateTransparentLogo();

  // 标题：学校名称合并为一行
  const headerChildren = [];
  
  // 构建学校名称标题 - 二号字体（44 half-points）
  let schoolTitle = '';
  if (schoolName && schoolSubName) {
    schoolTitle = schoolName + ' ' + schoolSubName;
  } else if (schoolName) {
    schoolTitle = schoolName;
  } else if (schoolSubName) {
    schoolTitle = schoolSubName;
  }
  
  if (schoolTitle) {
    headerChildren.push(
      new Paragraph({
        children: [new TextRun({ text: schoolTitle, bold: true, size: 44, color: '000000', font: FONT_TITLE })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 }
      })
    );
  }
  
  headerChildren.push(
    new Paragraph({
      children: [new TextRun({ text: '周工作行事历', bold: true, size: 36, color: '0891B2', font: FONT_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { before: schoolTitle ? 200 : 100, after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `第${weekNumber}周（${dateRange}）`, size: 24, color: '333333', font: FONT_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    })
  );

  // 收集所有部门的条目
  const allItems = [];
  for (const plan of plans) {
    if (plan.id !== 0) { // 只对真实计划查询条目
      const items = await query(
        `SELECT * FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false ORDER BY plan_date, sort_order`,
        [plan.id]
      );
      items.forEach(item => {
        allItems.push({
          ...item,
          dept_name: plan.dept_name,
          dept_sort: getDeptSortOrder(plan.dept_name)
        });
      });
    }
  }

  // 按日期和部门排序
  allItems.sort((a, b) => {
    const dateDiff = new Date(a.plan_date) - new Date(b.plan_date);
    if (dateDiff !== 0) return dateDiff;
    return a.dept_sort - b.dept_sort;
  });

  // 按日期分组（周日到周六）
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const itemsByWeekday = {};

  allItems.forEach(item => {
    // 提取星期几（0-6）
    const dateObj = new Date(item.plan_date);
    const dayOfWeek = isNaN(dateObj) ? 0 : dateObj.getDay();
    if (!itemsByWeekday[dayOfWeek]) {
      itemsByWeekday[dayOfWeek] = [];
    }
    itemsByWeekday[dayOfWeek].push(item);
  });

  // 生成数据行（每一天一行，同一天多个部门内容在同一单元格内）
  const dataRows = [];

  // 遍历周日到周六，确保7天完整显示
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(sd);
    currentDate.setDate(currentDate.getDate() + i);

    const dateStr = `${currentDate.getMonth() + 1}月${currentDate.getDate()}日`;
    const dayOfWeek = currentDate.getDay();
    const weekday = weekdayNames[dayOfWeek];

    // 周六显示"休息"
    if (dayOfWeek === 6) {
      dataRows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: dateStr, font: FONT_TABLE_CONTENT, size: 20 })],
              alignment: AlignmentType.CENTER,
              verticalAlign: 'center'
            })],
            borders: tableBorder,
            width: { size: 1404, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center'
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: weekday, font: FONT_TABLE_CONTENT, size: 20 })],
              alignment: AlignmentType.CENTER,
              verticalAlign: 'center'
            })],
            borders: tableBorder,
            width: { size: 936, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center'
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '休息', color: '999999', font: FONT_TABLE_CONTENT, size: 20 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              verticalAlign: 'center'
            })],
            borders: tableBorder,
            width: { size: 5148, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center'
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '——', font: FONT_TABLE_CONTENT, size: 20 })],
              alignment: AlignmentType.CENTER,
              verticalAlign: 'center'
            })],
            borders: tableBorder,
            width: { size: 1872, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center'
          })
        ]
      }));
      continue;
    }

    const rawDayItems = itemsByWeekday[dayOfWeek] || [];
    const dayItems = processMultilineItems(rawDayItems);

    // 如果当天无任务，显示"无任务"
    if (dayItems.length === 0) {
      dataRows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: dateStr, font: FONT_TABLE_CONTENT, size: 20 })],
              alignment: AlignmentType.CENTER,
              verticalAlign: 'center'
            })],
            borders: tableBorder,
            width: { size: 1404, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center'
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: weekday, font: FONT_TABLE_CONTENT, size: 20 })],
              alignment: AlignmentType.CENTER,
              verticalAlign: 'center'
            })],
            borders: tableBorder,
            width: { size: 936, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center'
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '无任务', color: '999999', font: FONT_TABLE_CONTENT, size: 20 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              verticalAlign: 'center'
            })],
            borders: tableBorder,
            width: { size: 5148, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center'
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '——', font: FONT_TABLE_CONTENT, size: 20 })],
              alignment: AlignmentType.CENTER,
              verticalAlign: 'center'
            })],
            borders: tableBorder,
            width: { size: 1872, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center'
          })
        ]
      }));
      continue;
    }

    // 构建工作内容单元格（多个部门内容合并，去掉部门名称，增加序号）
    const contentParagraphs = dayItems.map((item, index) => {
      return new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. `, size: 20, font: FONT_TABLE_CONTENT }),
          new TextRun({ text: item.content || '', size: 20, font: FONT_TABLE_CONTENT })
        ],
        spacing: { before: 100, after: 100 }
      });
    });

    // 构建负责人单元格（直接使用计划中的responsible字段）
    const responsibleParagraphs = dayItems.map((item, index) => {
      return new Paragraph({
        children: [new TextRun({ text: `${index + 1}. ${item.responsible || '——'}`, font: FONT_TABLE_CONTENT, size: 20 })],
        spacing: { before: 100, after: 100 },
        alignment: AlignmentType.LEFT
      });
    });

    dataRows.push(new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: dateStr, font: FONT_TABLE_CONTENT, size: 20 })],
            alignment: AlignmentType.CENTER,
            verticalAlign: 'center'
          })],
          borders: tableBorder,
          width: { size: 1404, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          verticalAlign: 'center'
        }),
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: weekday, font: FONT_TABLE_CONTENT, size: 20 })],
            alignment: AlignmentType.CENTER,
            verticalAlign: 'center'
          })],
          borders: tableBorder,
          width: { size: 936, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          verticalAlign: 'center'
        }),
        new TableCell({
          children: contentParagraphs,
          borders: tableBorder,
          width: { size: 5148, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 }
        }),
        new TableCell({
          children: responsibleParagraphs,
          borders: tableBorder,
          width: { size: 1872, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 }
        })
      ]
    }));
  }

  // 表头行
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: '日期', font: FONT_TABLE_HEADER, size: 20, bold: true })],
          alignment: AlignmentType.CENTER,
          verticalAlign: 'center'
        })],
        borders: tableBorder,
        width: { size: 1404, type: WidthType.DXA },
        shading: { fill: 'E0F2FE', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: 'center'
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: '星期', font: FONT_TABLE_HEADER, size: 20, bold: true })],
          alignment: AlignmentType.CENTER,
          verticalAlign: 'center'
        })],
        borders: tableBorder,
        width: { size: 936, type: WidthType.DXA },
        shading: { fill: 'E0F2FE', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: 'center'
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: '工作内容', font: FONT_TABLE_HEADER, size: 20, bold: true })],
          alignment: AlignmentType.CENTER,
          verticalAlign: 'center'
        })],
        borders: tableBorder,
        width: { size: 5148, type: WidthType.DXA },
        shading: { fill: 'E0F2FE', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: 'center'
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: '负责人', font: FONT_TABLE_HEADER, size: 20, bold: true })],
          alignment: AlignmentType.CENTER,
          verticalAlign: 'center'
        })],
        borders: tableBorder,
        width: { size: 1872, type: WidthType.DXA },
        shading: { fill: 'E0F2FE', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: 'center'
      })
    ]
  });

  // Logo 作为页面背景水印（放在页面中下方，50x50，透明）
  const backgroundChildren = [];
  if (logoData) {
    backgroundChildren.push(new Paragraph({
      children: [new ImageRun({
        data: logoData,
        transformation: { width: 50, height: 50 },
        type: 'png',
        altText: { title: 'Logo', description: 'School Logo', name: 'logo' }
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 2500, after: 0 }
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({ children: [] })
      },
      footers: {
        default: new Footer({ children: backgroundChildren })
      },
      children: [...headerChildren, new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1404, 936, 5148, 1872]
      })]
    }]
  });

  return doc;
}

// GET /plan/:planId 导出单个部门计划
router.get('/plan/:planId', authMiddleware, async (req, res) => {
  const { planId } = req.params;
  const plan = await queryOne(
    `SELECT p.*, d.name as dept_name FROM biz_week_plan p LEFT JOIN sys_department d ON p.department_id=d.id WHERE p.id=? AND p.is_deleted=false`,
    [planId]
  );
  if (!plan) return fail(res, '计划不存在', 404);

  const items = await query(
    `SELECT * FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false ORDER BY plan_date, sort_order`,
    [planId]
  );

  const schoolNameResult = await queryOne(`SELECT config_value FROM sys_config WHERE config_key='school_name'`);
  const schoolName = schoolNameResult?.config_value || '';
  
  const schoolSubNameResult = await queryOne(`SELECT config_value FROM sys_config WHERE config_key='school_sub_name'`);
  const schoolSubName = schoolSubNameResult?.config_value || '';

  try {
    const doc = buildDocxFromPlan(plan, items, schoolName, schoolSubName);
    const buffer = await Packer.toBuffer(doc);
    const filename = encodeURIComponent(`${plan.dept_name || ''}第${plan.week_number}周工作计划.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(buffer);
  } catch (e) {
    console.error('导出失败', e);
    fail(res, '导出失败: ' + e.message);
  }
});

// GET /weekly-summary/:weekNumber 导出某周所有部门汇总
router.get('/weekly-summary/:weekNumber', authMiddleware, async (req, res) => {
  const { weekNumber } = req.params;
  const { semester, status } = req.query;

  let where = `WHERE p.is_deleted=false AND p.week_number=?`;
  const params = [weekNumber];
  if (semester) { where += ` AND p.semester=?`; params.push(semester); }

  if (status === 'PUBLISHED') {
    where += ` AND p.status='PUBLISHED'`;
  } else if (status === 'REVIEW') {
    where += ` AND p.status IN ('DEPT_APPROVED', 'OFFICE_APPROVED', 'PUBLISHED')`;
  }

  const plans = await query(
    `SELECT p.*, d.name as dept_name FROM biz_week_plan p LEFT JOIN sys_department d ON p.department_id=d.id ${where} ORDER BY d.sort_order`,
    params
  );

  const schoolNameResult = await queryOne(`SELECT config_value FROM sys_config WHERE config_key='school_name'`);
  const schoolName = schoolNameResult?.config_value || '';
  
  const schoolSubNameResult = await queryOne(`SELECT config_value FROM sys_config WHERE config_key='school_sub_name'`);
  const schoolSubName = schoolSubNameResult?.config_value || '';

  // 如果没有计划，生成默认计划（仅包含空表格）
  let doc;
  if (!plans.length) {
    // 创建一个空计划用于生成模板
    const fakePlan = {
      id: 0,
      start_date: null,
      end_date: null
    };
    // 尝试获取当前学期的周次范围或者使用默认日期
    try {
      const weekStartConfig = await queryOne(`SELECT config_value FROM sys_config WHERE config_key='current_week_start'`);
      if (weekStartConfig?.config_value) {
        const startDate = new Date(weekStartConfig.config_value);
        startDate.setDate(startDate.getDate() + (parseInt(weekNumber) - 1) * 7);
        fakePlan.start_date = startDate.toISOString().split('T')[0];
        fakePlan.end_date = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else {
        // 如果没有配置，使用当前日期往前推到最近的周一
        const today = new Date();
        const day = today.getDay();
        const diff = (day === 1 ? 0 : (day === 0 ? -6 : 1 - day));
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff + (parseInt(weekNumber) - 1) * 7);
        fakePlan.start_date = monday.toISOString().split('T')[0];
        fakePlan.end_date = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
    } catch (e) {
      // 出错时使用任意日期
      fakePlan.start_date = '2026-01-01';
      fakePlan.end_date = '2026-01-07';
    }
    doc = await buildWeeklySummary([fakePlan], weekNumber, schoolName, schoolSubName);
  } else {
    doc = await buildWeeklySummary(plans, weekNumber, schoolName, schoolSubName);
  }

  try {
    const buffer = await Packer.toBuffer(doc);
    const filename = encodeURIComponent(`第${weekNumber}周全校工作计划汇总.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(buffer);
  } catch (e) {
    console.error('导出汇总失败', e);
    fail(res, '导出失败: ' + e.message);
  }
});

// 辅助函数：将 Word 转换为 PDF（支持 WPS Office 和 LibreOffice）
async function convertWordToPdf(wordBuffer, outputPdfPath) {
  return new Promise((resolve, reject) => {
    // 确保 temp 目录存在
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempWordPath = path.join(tempDir, `temp_${Date.now()}.docx`);
    fs.writeFileSync(tempWordPath, wordBuffer);

    // 检测可用的 Office 转换工具
    let officeCmd = null;
    const wpsPath = '/Applications/wpsoffice.app/Contents/MacOS/wpsoffice';
    const libreOfficePath = process.platform === 'darwin'
      ? '/Applications/LibreOffice.app/Contents/MacOS/soffice'
      : 'libreoffice';

    if (fs.existsSync(wpsPath)) {
      officeCmd = `"${wpsPath}"`;
      console.log('使用 WPS Office 进行 PDF 转换');
    } else if (process.platform === 'darwin' && fs.existsSync('/Applications/LibreOffice.app')) {
      officeCmd = libreOfficePath;
      console.log('使用 LibreOffice 进行 PDF 转换');
    } else if (process.platform !== 'darwin') {
      officeCmd = 'libreoffice';
      console.log('使用 LibreOffice 进行 PDF 转换');
    }

    if (!officeCmd) {
      // 删除临时文件
      try { fs.unlinkSync(tempWordPath); } catch (e) {}
      return reject(new Error('未找到可用的 Office 转换工具，请安装 WPS Office 或 LibreOffice'));
    }

    exec(
      `${officeCmd} --headless --convert-to pdf --outdir "${tempDir}" "${tempWordPath}"`,
      (error, stdout, stderr) => {
        // 删除临时 Word 文件
        try { fs.unlinkSync(tempWordPath); } catch (e) {}

        if (error) {
          console.error('Office 转换失败:', stderr);
          return reject(new Error('PDF 转换失败：' + (stderr || error.message)));
        }

        // 重命名 PDF 文件
        const pdfPath = tempWordPath.replace('.docx', '.pdf');
        try {
          if (fs.existsSync(pdfPath)) {
            fs.renameSync(pdfPath, outputPdfPath);
            console.log('PDF 转换成功:', outputPdfPath);
            resolve();
          } else {
            reject(new Error('PDF 文件未生成'));
          }
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

// GET /plan/:planId/pdf 导出单个部门计划为 PDF
router.get('/plan/:planId/pdf', authMiddleware, async (req, res) => {
  const { planId } = req.params;
  const plan = await queryOne(
    `SELECT p.*, d.name as dept_name FROM biz_week_plan p LEFT JOIN sys_department d ON p.department_id=d.id WHERE p.id=? AND p.is_deleted=false`,
    [planId]
  );
  if (!plan) return fail(res, '计划不存在', 404);

  const items = await query(
    `SELECT * FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false ORDER BY plan_date, sort_order`,
    [planId]
  );

  const schoolName = (await queryOne(`SELECT config_value FROM sys_config WHERE config_key='school_name'`))?.config_value || '';
  const schoolSubName = (await queryOne(`SELECT config_value FROM sys_config WHERE config_key='school_sub_name'`))?.config_value || '';

  try {
    const doc = buildDocxFromPlan(plan, items, schoolName, schoolSubName);
    const wordBuffer = await Packer.toBuffer(doc);

    const tempPdfPath = path.join(__dirname, `../../temp/pdf_${Date.now()}.pdf`);
    await convertWordToPdf(wordBuffer, tempPdfPath);

    const pdfBuffer = fs.readFileSync(tempPdfPath);

    // 删除临时 PDF 文件
    try { fs.unlinkSync(tempPdfPath); } catch (e) {}

    const filename = encodeURIComponent(`${plan.dept_name || ''}第${plan.week_number}周工作计划.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error('导出 PDF 失败', e);
    fail(res, '导出失败: ' + e.message);
  }
});

// GET /weekly-summary/:weekNumber/pdf 导出某周所有部门汇总为 PDF
router.get('/weekly-summary/:weekNumber/pdf', authMiddleware, async (req, res) => {
  const { weekNumber } = req.params;
  const { semester, status } = req.query;

  let where = `WHERE p.is_deleted=false AND p.week_number=?`;
  const params = [weekNumber];
  if (semester) { where += ` AND p.semester=?`; params.push(semester); }

  if (status === 'PUBLISHED') {
    where += ` AND p.status='PUBLISHED'`;
  } else if (status === 'REVIEW') {
    where += ` AND p.status IN ('DEPT_APPROVED', 'OFFICE_APPROVED', 'PUBLISHED')`;
  }

  const plans = await query(
    `SELECT p.*, d.name as dept_name FROM biz_week_plan p LEFT JOIN sys_department d ON p.department_id=d.id ${where} ORDER BY d.sort_order`,
    params
  );

  const schoolName = (await queryOne(`SELECT config_value FROM sys_config WHERE config_key='school_name'`))?.config_value || '';
  const schoolSubName = (await queryOne(`SELECT config_value FROM sys_config WHERE config_key='school_sub_name'`))?.config_value || '';

  // 如果没有计划，生成默认计划（仅包含空表格）
  let doc;
  if (!plans.length) {
    // 创建一个空计划用于生成模板
    const fakePlan = {
      id: 0,
      start_date: null,
      end_date: null
    };
    // 尝试获取当前学期的周次范围或者使用默认日期
    try {
      const weekStartConfig = await queryOne(`SELECT config_value FROM sys_config WHERE config_key='current_week_start'`);
      if (weekStartConfig?.config_value) {
        const startDate = new Date(weekStartConfig.config_value);
        startDate.setDate(startDate.getDate() + (parseInt(weekNumber) - 1) * 7);
        fakePlan.start_date = startDate.toISOString().split('T')[0];
        fakePlan.end_date = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else {
        // 如果没有配置，使用当前日期往前推到最近的周一
        const today = new Date();
        const day = today.getDay();
        const diff = (day === 1 ? 0 : (day === 0 ? -6 : 1 - day));
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff + (parseInt(weekNumber) - 1) * 7);
        fakePlan.start_date = monday.toISOString().split('T')[0];
        fakePlan.end_date = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
    } catch (e) {
      // 出错时使用任意日期
      fakePlan.start_date = '2026-01-01';
      fakePlan.end_date = '2026-01-07';
    }
    doc = await buildWeeklySummary([fakePlan], weekNumber, schoolName, schoolSubName);
  } else {
    doc = await buildWeeklySummary(plans, weekNumber, schoolName, schoolSubName);
  }

  try {
    const wordBuffer = await Packer.toBuffer(doc);
    const tempPdfPath = path.join(__dirname, `../../temp/pdf_summary_${Date.now()}.pdf`);
    await convertWordToPdf(wordBuffer, tempPdfPath);

    const pdfBuffer = fs.readFileSync(tempPdfPath);

    // 删除临时 PDF 文件
    try { fs.unlinkSync(tempPdfPath); } catch (e) {}

    const filename = encodeURIComponent(`第${weekNumber}周全校工作计划汇总.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error('导出 PDF 汇总失败', e);
    fail(res, '导出失败: ' + e.message);
  }
});

module.exports = router;
