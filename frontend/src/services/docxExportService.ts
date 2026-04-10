import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ImageRun } from 'docx'
import { saveAs } from 'file-saver'
import axios from 'axios'
import { API_SERVER_BASE } from '@/config/api'

// 选项接口
interface Option {
  label?: string
  value?: string
  text?: string
  option_label?: string
  option_value?: string
  option_text?: string
}

// 题目类型接口
interface Question {
  id: number
  question_number: number
  question_text: string
  question_type: 'text' | 'code'
  difficulty: 'easy' | 'medium' | 'hard'
  options: Option[]
  correct_answer: string
  explanation: string
  question_code?: string
  level: number
  image_url?: string
  created_at: string
  question_date?: string
  images?: { image_url: string }[]
}

// 考试接口
interface Exam {
  id: number
  name: string
  level: number
  type: string
  description?: string
  questions: Question[]
  created_at: string
}

// 导出选项接口
interface ExportOptions {
  withAnswers: boolean
  withoutAnswers: boolean
  answerOnly: boolean
  customFilenames?: {
    withAnswers?: string
    withoutAnswers?: string
    answerOnly?: string
  }
}

class DocxExportService {
  /**
   * 导出考试为Word文档
   */
  async exportExam(exam: Exam, options: ExportOptions): Promise<void> {
    try {
      // 验证考试数据
      if (!exam) {
        throw new Error('考试数据为空')
      }
      
      // 确保questions是一个数组
      if (!Array.isArray(exam.questions)) {
        exam.questions = []
      }
      
      // 检查是否有题目
      if (exam.questions.length === 0) {
        throw new Error('该考试没有题目，无法导出')
      }
      
      if (options.withAnswers) {
        await this.exportWithAnswers(exam, options.customFilenames?.withAnswers)
      }
      
      if (options.withoutAnswers) {
        await this.exportWithoutAnswers(exam, options.customFilenames?.withoutAnswers)
      }
      
      if (options.answerOnly) {
        await this.exportAnswerOnly(exam, options.customFilenames?.answerOnly)
      }
    } catch (error) {
      console.error('导出考试失败:', error)
      throw new Error('导出考试失败: ' + (error as Error).message)
    }
  }

  /**
   * 下载图片并转换为 ArrayBuffer
   */
  private async downloadImage(imageUrl: string): Promise<ArrayBuffer | null> {
    try {
      // 处理相对URL和绝对URL
      let fullUrl = imageUrl
      if (imageUrl.startsWith('/uploads/')) {
        fullUrl = `${API_SERVER_BASE}${imageUrl}`
      }

      const response = await axios.get(fullUrl, {
        responseType: 'arraybuffer',
        timeout: 10000 // 10秒超时
      })
      
      return response.data
    } catch (error) {
      console.error('下载图片失败:', imageUrl, error)
      return null
    }
  }

  /**
   * 获取图片的原始尺寸
   */
  private async getImageDimensions(imageBuffer: ArrayBuffer): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([imageBuffer])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.width, height: img.height })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('无法加载图片'))
      }
      
      img.src = url
    })
  }

  /**
   * 计算适合Word文档的图片尺寸
   */
  private calculateImageSize(originalWidth: number, originalHeight: number): { width: number; height: number } {
    // Word文档页面宽度约为 595 点（A4纸），留边距后可用宽度约 500 点
    const maxWidth = 500
    const maxHeight = 400
    
    let width = originalWidth
    let height = originalHeight
    
    // 如果图片宽度超过最大宽度，按比例缩放
    if (width > maxWidth) {
      const ratio = maxWidth / width
      width = maxWidth
      height = height * ratio
    }
    
    // 如果缩放后高度仍超过最大高度，再次按比例缩放
    if (height > maxHeight) {
      const ratio = maxHeight / height
      height = maxHeight
      width = width * ratio
    }
    
    return { width: Math.round(width), height: Math.round(height) }
  }

  /**
   * 创建图片段落
   */
  private async createImageParagraph(imageUrl: string): Promise<Paragraph | null> {
    try {
      const imageBuffer = await this.downloadImage(imageUrl)
      if (!imageBuffer) {
        return null
      }

      // 获取图片原始尺寸
      const originalSize = await this.getImageDimensions(imageBuffer)
      
      // 计算适合的显示尺寸
      const displaySize = this.calculateImageSize(originalSize.width, originalSize.height)

      // 将 ArrayBuffer 转换为 Uint8Array（浏览器兼容）
      const uint8Array = new Uint8Array(imageBuffer)

      // 创建带图片的段落
      return new Paragraph({
        children: [
          new ImageRun({
            data: uint8Array,
            transformation: {
              width: displaySize.width,
              height: displaySize.height
            }
          } as any)
        ],
        spacing: { before: 150, after: 150 },
        alignment: AlignmentType.CENTER  // 图片居中显示
      })
    } catch (error) {
      console.error('创建图片段落失败:', error)
      return null
    }
  }

  /**
   * 导出含解析的版本
   */
  private async exportWithAnswers(exam: Exam, customFilename?: string): Promise<void> {
    // 获取题目列表（含解析）- 异步处理图片
    const questionsParagraphs = await this.createQuestionsWithAnswers(exam.questions)
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 标题
          new Paragraph({
            text: exam.name,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // 考试信息
          ...this.createExamInfoSection(exam),

          // 题目列表（含解析）
          ...questionsParagraphs,

          // 页脚
          new Paragraph({
            text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 }
          })
        ]
      }]
    })

    const buffer = await Packer.toBlob(doc)
    const fileName = this.generateFilename(exam, '含解析', customFilename)
    saveAs(buffer, fileName)
  }

  /**
   * 导出不含解析的版本
   */
  private async exportWithoutAnswers(exam: Exam, customFilename?: string): Promise<void> {
    // 获取题目列表（不含解析）- 异步处理图片
    const questionsParagraphs = await this.createQuestionsWithoutAnswers(exam.questions)
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 标题
          new Paragraph({
            text: exam.name,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // 考试信息
          ...this.createExamInfoSection(exam),

          // 题目列表（不含解析）
          ...questionsParagraphs,

          // 页脚
          new Paragraph({
            text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 }
          })
        ]
      }]
    })

    const buffer = await Packer.toBlob(doc)
    const fileName = this.generateFilename(exam, '不含解析', customFilename)
    saveAs(buffer, fileName)
  }

  /**
   * 导出纯答案版本（答案表格+解析）
   */
  private async exportAnswerOnly(exam: Exam, customFilename?: string): Promise<void> {
    // 获取解析部分 - 异步处理图片
    const explanationsParagraphs = await this.createExplanationsSection(exam.questions)
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 标题
          new Paragraph({
            text: `${exam.name} - 答案与解析`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // 考试信息
          ...this.createExamInfoSection(exam),

          // 答案表格部分
          ...(() => {
            const answerSheet = this.createAnswerSheetSection(exam.questions)
            return [...answerSheet.paragraphs, answerSheet.table]
          })(),

          // 解析部分
          ...explanationsParagraphs,

          // 页脚
          new Paragraph({
            text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 }
          })
        ]
      }]
    })

    const buffer = await Packer.toBlob(doc)
    const fileName = this.generateFilename(exam, '纯答案', customFilename)
    saveAs(buffer, fileName)
  }

  /**
   * 创建考试信息部分
   */
  private createExamInfoSection(exam: Exam): Paragraph[] {
    // 确保questions是数组
    const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0
    
    return [
      new Paragraph({
        text: '考试信息',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `考试等级: ${this.getLevelText(exam.level)}`,
            bold: true
          })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `考试类型: ${exam.type || '真题'}`,
            bold: true
          })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `题目数量: ${questionCount} 题`,
            bold: true
          })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `创建时间: ${this.formatDate(exam.created_at)}`,
            bold: true
          })
        ],
        spacing: { after: 200 }
      }),
      ...(exam.description ? [
        new Paragraph({
          children: [
            new TextRun({
              text: `考试描述: ${exam.description}`,
              bold: true
            })
          ],
          spacing: { after: 300 }
        })
      ] : [])
    ]
  }

  /**
   * 创建含解析的题目列表
   */
  private async createQuestionsWithAnswers(questions: Question[]): Promise<Paragraph[]> {
    // 确保questions是数组
    if (!Array.isArray(questions)) {
      questions = []
    }
    
    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: '题目列表（含解析）',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    ]

    for (const question of questions) {
      // 题目标题
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `第${question.question_number}题`,
              bold: true,
              size: 24
            })
          ],
          spacing: { before: 300, after: 150 }
        })
      )

      // 题目内容
      paragraphs.push(
        new Paragraph({
          text: question.question_text,
          spacing: { after: 150 }
        })
      )

      // 题目图片（如果有）
      if (question.image_url) {
        const imageParagraph = await this.createImageParagraph(question.image_url)
        if (imageParagraph) {
          paragraphs.push(imageParagraph)
        }
      }

      // 代码（如果是代码题）
      if (question.question_code) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '代码:',
                bold: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          }),
          ...this.createCodeParagraphs(question.question_code),
          new Paragraph({
            text: '', // 空段落用于增加代码后的间距
            spacing: { after: 150 }
          })
        )
      }

      // 选项（如果有）
      if (question.options && question.options.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '选项:',
                bold: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          })
        )

        question.options.forEach(option => {
          const label = option.label || option.option_label || ''
          const text = option.text || option.option_text || ''
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${label}. `,
                  bold: true,
                  size: 20
                }),
                new TextRun({
                  text: text,
                  size: 20
                })
              ],
              spacing: { after: 50 }
            })
          )
        })
      }

      // 正确答案
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '正确答案: ',
              bold: true,
              size: 20,
              color: '006600'
            }),
            new TextRun({
              text: question.correct_answer || '未设置',
              bold: true,
              size: 20,
              color: '006600'
            })
          ],
          spacing: { after: 100 }
        })
      )

      // 解析
      if (question.explanation) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '解析:',
                bold: true,
                size: 20,
                color: '0066CC'
              })
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: question.explanation,
            spacing: { after: 200 }
          })
        )
      }

      // 分隔线
      paragraphs.push(
        new Paragraph({
          text: '────────────────────────────────────────',
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        })
      )
    }

    return paragraphs
  }

  /**
   * 创建不含解析的题目列表
   */
  private async createQuestionsWithoutAnswers(questions: Question[]): Promise<Paragraph[]> {
    // 确保questions是数组
    if (!Array.isArray(questions)) {
      questions = []
    }
    
    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: '题目列表（练习版）',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    ]

    for (const question of questions) {
      // 题目标题
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `第${question.question_number}题`,
              bold: true,
              size: 24
            })
          ],
          spacing: { before: 300, after: 150 }
        })
      )

      // 题目内容
      paragraphs.push(
        new Paragraph({
          text: question.question_text,
          spacing: { after: 150 }
        })
      )

      // 题目图片（如果有）
      if (question.image_url) {
        const imageParagraph = await this.createImageParagraph(question.image_url)
        if (imageParagraph) {
          paragraphs.push(imageParagraph)
        }
      }

      // 代码（如果是代码题）
      if (question.question_code) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '代码:',
                bold: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          }),
          ...this.createCodeParagraphs(question.question_code),
          new Paragraph({
            text: '', // 空段落用于增加代码后的间距
            spacing: { after: 150 }
          })
        )
      }

      // 选项（如果有）
      if (question.options && question.options.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '选项:',
                bold: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          })
        )

        question.options.forEach(option => {
          const label = option.label || option.option_label || ''
          const text = option.text || option.option_text || ''
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${label}. `,
                  bold: true,
                  size: 20
                }),
                new TextRun({
                  text: text,
                  size: 20
                })
              ],
              spacing: { after: 50 }
            })
          )
        })
      }

      // 分隔线
      paragraphs.push(
        new Paragraph({
          text: '────────────────────────────────────────',
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        })
      )
    }

    return paragraphs
  }

  /**
   * 获取等级文本
   */
  private getLevelText(level: number): string {
    return `GESP ${level}级`
  }

  /**
   * 获取难度文本
   */
  private getDifficultyText(difficulty: string): string {
    const difficultyMap: { [key: string]: string } = {
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    }
    return difficultyMap[difficulty] || '中等'
  }

  /**
   * 格式化日期
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN')
  }

  /**
   * 获取当前日期字符串
   */
  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * 生成文件名
   */
  private generateFilename(exam: Exam, suffix: string, customFilename?: string): string {
    // 如果有自定义文件名，直接使用
    if (customFilename?.trim()) {
      const filename = customFilename.trim()
      // 如果已经包含.docx后缀，直接返回
      if (filename.endsWith('.docx')) {
        return filename
      }
      // 否则添加.docx后缀
      return `${filename}.docx`
    }
    
    // 没有自定义文件名时，使用默认格式
    const date = this.getCurrentDate()
    return `${exam.name}_${suffix}_${date}.docx`
  }

  /**
   * 创建代码段落，保持缩进和换行
   */
  private createCodeParagraphs(code: string): Paragraph[] {
    if (!code) return []
    
    // 按行分割代码
    const lines = code.split('\n')
    
    return lines.map(line => {
      // 保留每行的前导空格（缩进）
      const preservedLine = line.replace(/^(\s*)/, (match) => {
        // 将空格转换为不间断空格，保持缩进
        return match.replace(/ /g, '\u00A0') // 不间断空格
      })
      
      return new Paragraph({
        children: [
          new TextRun({
            text: preservedLine || ' ', // 空行显示为单个空格
            font: 'Consolas',
            size: 20,
            color: '0066CC'
          })
        ],
        spacing: { after: 0 },
        indent: { left: 0 }
      })
    })
  }

  /**
   * 创建答案表格部分
   */
  private createAnswerSheetSection(questions: Question[]): { paragraphs: Paragraph[], table: Table } {
    // 确保questions是数组
    if (!Array.isArray(questions)) {
      questions = []
    }
    
    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: '答案表格',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        text: '以下是所有题目的正确答案，方便批改时使用：',
        spacing: { after: 200 }
      })
    ]

    // 创建答案表格
    const tableRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '题号', bold: true })]
            })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '正确答案', bold: true })]
            })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: '选项内容', bold: true })]
            })],
            width: { size: 60, type: WidthType.PERCENTAGE }
          })
        ]
      })
    ]

    questions.forEach(question => {
      const correctOption = question.options?.find(option => 
        (option.label || option.option_label) === question.correct_answer
      )
      
      tableRows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: question.question_number.toString() })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: question.correct_answer, bold: true })]
            })]
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: correctOption ? (correctOption.text || correctOption.option_text || '') : '' 
            })]
          })
        ]
      }))
    })

    const table = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    })

    return { paragraphs, table }
  }

  /**
   * 创建解析部分
   */
  private async createExplanationsSection(questions: Question[]): Promise<Paragraph[]> {
    // 确保questions是数组
    if (!Array.isArray(questions)) {
      questions = []
    }
    
    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: '题目解析',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    ]

    for (let index = 0; index < questions.length; index++) {
      const question = questions[index]
      
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `第${question.question_number}题解析`,
              bold: true,
              size: 24
            })
          ],
          spacing: { before: 300, after: 150 }
        }),
        new Paragraph({
          text: question.question_text,
          spacing: { after: 150 }
        })
      )

      // 题目图片（如果有）
      if (question.image_url) {
        const imageParagraph = await this.createImageParagraph(question.image_url)
        if (imageParagraph) {
          paragraphs.push(imageParagraph)
        }
      }

      if (question.question_code) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '代码:',
                bold: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          }),
          ...this.createCodeParagraphs(question.question_code),
          new Paragraph({
            text: '',
            spacing: { after: 150 }
          })
        )
      }

      if (question.options && question.options.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '选项:',
                bold: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          })
        )

        question.options.forEach(option => {
          const label = option.label || option.option_label || ''
          const text = option.text || option.option_text || ''
          const isCorrect = label === question.correct_answer
          
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({
                text: `${label}. `,
                bold: true,
                size: 20,
                color: isCorrect ? '008000' : '000000'
              }),
              new TextRun({
                text: text,
                size: 20,
                color: isCorrect ? '008000' : '000000'
              }),
              ...(isCorrect ? [new TextRun({
                text: ' ✓',
                bold: true,
                color: '008000'
              })] : [])
            ],
            spacing: { after: 50 }
          }))
        })
      }

      if (question.explanation) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '解析:',
                bold: true,
                size: 20
              })
            ],
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({
            text: question.explanation,
            spacing: { after: 200 }
          })
        )
      }

      if (index < questions.length - 1) {
        paragraphs.push(new Paragraph({
          text: '─────────────────────────────────────',
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 }
        }))
      }
    }

    return paragraphs
  }

  /**
   * 导出错题为Word文档
   */
  async exportWrongQuestions(
    submission: any,
    wrongQuestions: any[],
    customFilename?: string
  ): Promise<void> {
    try {
      // 验证数据
      if (!submission) {
        throw new Error('提交记录为空')
      }
      
      if (!Array.isArray(wrongQuestions) || wrongQuestions.length === 0) {
        throw new Error('没有错题，无法导出')
      }
      
      // 获取错题列表（含解析）- 异步处理图片
      const questionsParagraphs = await this.createWrongQuestionsWithAnswers(wrongQuestions, submission)
      
      const studentName = submission.real_name || submission.username || '学生'
      const examName = submission.exam_name || '考试'
      const attemptNumber = submission.attempt_number || 1
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // 标题
            new Paragraph({
              text: `${studentName} - ${examName} 错题集`,
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // 提交信息
            ...this.createSubmissionInfoSection(submission),

            // 错题列表（含解析）
            ...questionsParagraphs,

            // 页脚
            new Paragraph({
              text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
              alignment: AlignmentType.RIGHT,
              spacing: { before: 400 }
            })
          ]
        }]
      })

      const buffer = await Packer.toBlob(doc)
      const fileName = this.generateWrongQuestionsFilename(submission, customFilename)
      saveAs(buffer, fileName)
    } catch (error) {
      console.error('导出错题失败:', error)
      throw new Error('导出错题失败: ' + (error as Error).message)
    }
  }

  /**
   * 创建提交信息部分
   */
  private createSubmissionInfoSection(submission: any): Paragraph[] {
    const studentName = submission.real_name || submission.username || '学生'
    const examName = submission.exam_name || '考试'
    const attemptNumber = submission.attempt_number || 1
    const score = submission.score || 0
    const submitTime = this.formatDate(submission.submit_time) || '未知时间'
    
    return [
      new Paragraph({
        text: '提交信息',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `学生姓名: ${studentName}`,
            bold: true
          })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `考试名称: ${examName}`,
            bold: true
          })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `提交次数: 第 ${attemptNumber} 次`,
            bold: true
          })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `得分: ${score} 分`,
            bold: true
          })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `提交时间: ${submitTime}`,
            bold: true
          })
        ],
        spacing: { after: 200 }
      })
    ]
  }

  /**
   * 创建错题列表（含正确答案、学生答案和解析）
   */
  private async createWrongQuestionsWithAnswers(wrongQuestions: any[], submission: any): Promise<Paragraph[]> {
    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: '错题列表',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        text: `共 ${wrongQuestions.length} 道错题，以下是详细内容：`,
        spacing: { after: 200 }
      })
    ]

    for (const answer of wrongQuestions) {
      // 题目标题
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `第${answer.question_number || '?'}题`,
              bold: true,
              size: 24
            })
          ],
          spacing: { before: 300, after: 150 }
        })
      )

      // 题目内容
      paragraphs.push(
        new Paragraph({
          text: answer.question_text || '',
          spacing: { after: 150 }
        })
      )

      // 题目图片（如果有）
      if (answer.image_url) {
        const imageParagraph = await this.createImageParagraph(answer.image_url)
        if (imageParagraph) {
          paragraphs.push(imageParagraph)
        }
      }

      // 代码（如果是代码题）
      if (answer.question_code) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '代码:',
                bold: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          }),
          ...this.createCodeParagraphs(answer.question_code),
          new Paragraph({
            text: '',
            spacing: { after: 150 }
          })
        )
      }

      // 选项（如果有）
      if (answer.options && answer.options.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '选项:',
                bold: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          })
        )

        answer.options.forEach(option => {
          const label = option.label || option.option_label || ''
          const text = option.text || option.option_text || ''
          const isCorrect = label === answer.correct_answer
          const isStudentAnswer = label === answer.user_answer
          
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${label}. `,
                  bold: true,
                  size: 20,
                  color: isCorrect ? '008000' : (isStudentAnswer ? 'FF0000' : '000000')
                }),
                new TextRun({
                  text: text,
                  size: 20,
                  color: isCorrect ? '008000' : (isStudentAnswer ? 'FF0000' : '000000')
                }),
                ...(isCorrect ? [new TextRun({
                  text: ' ✓ (正确答案)',
                  bold: true,
                  color: '008000'
                })] : []),
                ...(isStudentAnswer && !isCorrect ? [new TextRun({
                  text: ' ✗ (学生答案)',
                  bold: true,
                  color: 'FF0000'
                })] : [])
              ],
              spacing: { after: 50 }
            })
          )
        })
      }

      // 学生答案
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '学生答案: ',
              bold: true,
              size: 20,
              color: 'FF0000'
            }),
            new TextRun({
              text: answer.user_answer || '未作答',
              bold: true,
              size: 20,
              color: 'FF0000'
            })
          ],
          spacing: { after: 100 }
        })
      )

      // 正确答案
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '正确答案: ',
              bold: true,
              size: 20,
              color: '006600'
            }),
            new TextRun({
              text: answer.correct_answer || '未设置',
              bold: true,
              size: 20,
              color: '006600'
            })
          ],
          spacing: { after: 100 }
        })
      )

      // 解析
      if (answer.explanation) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '解析:',
                bold: true,
                size: 20,
                color: '0066CC'
              })
            ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: answer.explanation,
            spacing: { after: 200 }
          })
        )
      }

      // 分隔线
      paragraphs.push(
        new Paragraph({
          text: '────────────────────────────────────────',
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        })
      )
    }

    return paragraphs
  }

  /**
   * 生成错题文件名
   */
  private generateWrongQuestionsFilename(submission: any, customFilename?: string): string {
    // 如果有自定义文件名，直接使用
    if (customFilename?.trim()) {
      const filename = customFilename.trim()
      // 如果已经包含.docx后缀，直接返回
      if (filename.endsWith('.docx')) {
        return filename
      }
      // 否则添加.docx后缀
      return `${filename}.docx`
    }
    
    // 没有自定义文件名时，使用默认格式
    const studentName = submission.real_name || submission.username || '学生'
    const examName = submission.exam_name || '考试'
    const attemptNumber = submission.attempt_number || 1
    const date = this.getCurrentDate()
    return `${studentName}_${examName}_第${attemptNumber}次错题_${date}.docx`
  }
}

// 导出单例实例
export const docxExportService = new DocxExportService()
export default docxExportService
