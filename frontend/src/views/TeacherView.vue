
<template>
  <div class="profile-layout">
    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 客观题提交 -->
      <div v-if="currentActiveSection === 'objective-submissions'" class="student-management-wrapper">
        <div class="student-management-main">
          <ObjectiveSubmissionsSection />
        </div>
      </div>
      
      <!-- OJ提交 -->
      <div v-if="currentActiveSection === 'oj-submissions'" class="student-management-wrapper">
        <div class="student-management-main">
          <OJSubmissionsSection />
        </div>
      </div>
      
      <!-- 测试管理 -->
      <div v-if="currentActiveSection === 'my-tests'" class="student-management-wrapper">
        <div class="student-management-main">
          <AdminTestManagementSection />
        </div>
      </div>
      
      <!-- 学生管理 -->
      <div v-if="currentActiveSection === 'student-management'" class="student-management-wrapper" :class="{ 'has-panel': selectedStudentForPlanProgress || selectedStudentForPlanManagement }">
        <div class="student-management-main">
          <StudentManagementSection 
            :students="students"
            :loading="studentsLoading"
            :has-panel="!!(selectedStudentForPlanProgress || selectedStudentForPlanManagement)"
            @bind-student="handleBindStudent"
            @create-student="showCreateStudentDialog = true"
            @batch-create-student="showBatchCreateDialog = true"
            @view-plan-progress="showStudentPlanProgress"
            @manage-plans="showStudentPlanManagement"
            @reset-password="handleResetPassword"
            @unbind-student="handleUnbindStudent"
            @update-class="handleUpdateClass"
          />
        </div>
        <!-- 学生计划完成面板 -->
        <StudentPlanProgressPanel
          v-if="selectedStudentForPlanProgress"
          :student-id="selectedStudentForPlanProgress.id"
          :student-info="selectedStudentForPlanProgress"
          :teacher-id="userInfo?.id || 0"
          @close="closeStudentPlanProgress"
        />
        <!-- 学生计划管理面板 -->
        <StudentPlanManagementPanel
          v-if="selectedStudentForPlanManagement"
          :student-id="selectedStudentForPlanManagement.id"
          :student-info="selectedStudentForPlanManagement"
          :teacher-id="userInfo?.id || 0"
          @close="closeStudentPlanManagement"
          @plan-updated="handlePlanUpdated"
        />
      </div>
      
    </main>
      

      <!-- 创建学生对话框 -->
      <div v-if="showCreateStudentDialog" class="dialog-overlay" @click="closeCreateStudentDialog">
        <div class="dialog" @click.stop>
          <div class="dialog-header">
            <h3>创建学生</h3>
            <button @click="closeCreateStudentDialog" class="btn-close">&times;</button>
          </div>
          <div class="dialog-body">
            <form @submit.prevent="createStudent" class="user-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="student_username">用户名 *</label>
                  <input 
                    id="student_username"
                    v-model="newStudent.username" 
                    type="text" 
                    required 
                    placeholder="请输入用户名"
                  />
                </div>
                <div class="form-group">
                  <label for="student_password">密码 *</label>
                  <input 
                    id="student_password"
                    v-model="newStudent.password" 
                    type="password" 
                    required 
                    placeholder="请输入密码"
                  />
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="student_class_no">班级编号</label>
                  <input 
                    id="student_class_no"
                    v-model="newStudent.class_no" 
                    type="text" 
                    placeholder="如：1班、2班（可选）"
                  />
                </div>
                <div class="form-group">
                  <label for="student_email">邮箱</label>
                  <input 
                    id="student_email"
                    v-model="newStudent.email" 
                    type="email" 
                    placeholder="请输入邮箱地址"
                  />
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="student_real_name">真实姓名</label>
                  <input 
                    id="student_real_name"
                    v-model="newStudent.real_name" 
                    type="text" 
                    placeholder="请输入真实姓名"
                  />
                </div>
              </div>
              
              <div class="form-group">
                <label>角色</label>
                <div class="role-info">
                  <span class="role-badge role-user">普通用户</span>
                  <span class="role-description">学生将自动获得普通用户角色</span>
                </div>
              </div>
              
              <div class="form-group">
                <label>自动绑定</label>
                <div class="bind-option">
                  <label class="bind-checkbox">
                    <input 
                      type="checkbox" 
                      v-model="autoBindStudent"
                      checked
                    />
                    <span class="bind-label">创建后自动绑定到我的学生列表</span>
                  </label>
                  <span class="bind-description">取消勾选则只创建学生账户，不进行绑定</span>
                </div>
              </div>
              
              <div class="dialog-actions">
                <button type="button" @click="closeCreateStudentDialog" class="btn-secondary">
                  取消
                </button>
                <button type="submit" class="btn-primary" :disabled="isCreatingStudent">
                  {{ isCreatingStudent ? '创建中...' : '创建学生' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
        
      <!-- 绑定学生对话框 -->
      <div v-if="showBindStudentDialog" class="dialog-overlay" @click="closeBindStudentDialog">
        <div class="dialog dialog-large" @click.stop>
          <div class="dialog-header">
            <h3>绑定学生</h3>
            <button @click="closeBindStudentDialog" class="btn-close">&times;</button>
          </div>
          <div class="dialog-body">
            <div v-if="availableStudents.length === 0" class="empty-state">
              <p>暂无可绑定的学生</p>
          </div>
            <div v-else class="available-students">
              <h4>选择要绑定的学生：</h4>
              
              <!-- 班级编号 -->
              <div class="form-group bind-class-row">
                <label for="bind_class_no">班级编号</label>
                <input 
                  id="bind_class_no"
                  v-model="bindStudentClassNo" 
                  type="text" 
                  placeholder="如：1班、2班、A班（可选）"
                  class="class-no-input"
                />
              </div>
              
              <!-- 搜索框 -->
              <div class="search-box">
                <input 
                  v-model="bindStudentSearchQuery" 
                  type="text" 
                  placeholder="搜索学生用户名、真实姓名或邮箱..."
                  class="search-input"
                />
                <Icon name="search" :size="18" class="search-icon" />
              </div>
              
              <!-- 搜索结果提示 -->
              <div v-if="bindStudentSearchQuery.trim()" class="search-results-info">
                <span>找到 {{ filteredAvailableStudents.length }} 个学生</span>
              </div>
              
              <div class="students-list">
                <div 
                  v-for="student in filteredAvailableStudents" 
                  :key="student.id"
                  class="student-option"
                  :class="{ selected: selectedStudentIds.includes(student.id) }"
                  @click="toggleStudentSelection(student.id)"
                >
                  <input 
                    type="checkbox" 
                    :checked="selectedStudentIds.includes(student.id)"
                    @change="toggleStudentSelection(student.id)"
                  />
                  <div class="student-option-info">
                    <div class="student-avatar-small">
                      {{ student.real_name ? student.real_name.charAt(0) : student.username.charAt(0) }}
                    </div>
                    <div class="student-option-details">
                      <h5>{{ student.real_name || student.username }}</h5>
                      <p>{{ student.username }}</p>
                      <p v-if="student.email">{{ student.email }}</p>
                  </div>
                </div>
                </div>
              </div>
            </div>
                
            <div class="dialog-actions">
              <button type="button" @click="closeBindStudentDialog" class="btn-secondary">
                取消
              </button>
              <button 
                @click="bindStudents(selectedStudentIds)" 
                class="btn-primary" 
                :disabled="isBindingStudent || selectedStudentIds.length === 0"
              >
                {{ isBindingStudent ? '绑定中...' : `绑定 ${selectedStudentIds.length} 个学生` }}
              </button>
          </div>
        </div>
            </div>
          </div>

    <!-- 批量创建学生对话框 -->
    <div v-if="showBatchCreateDialog" class="dialog-overlay" @click="closeBatchCreateDialog">
      <div class="dialog dialog-large" @click.stop>
        <div class="dialog-header">
          <h3>批量创建学生</h3>
          <button @click="closeBatchCreateDialog" class="btn-close">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="batch-info">
            <p>输入学生真实姓名，系统将自动生成用户名（拼音+随机数字）和初始密码（123456）</p>
          </div>
          <div class="form-group batch-class-row">
            <label for="batch_class_no">班级编号</label>
            <input 
              id="batch_class_no"
              v-model="batchClassNo" 
              type="text" 
              placeholder="如：1班、2班（可选，将应用于本批所有学生）"
              class="class-no-input"
            />
          </div>
          <div class="batch-students-list">
            <div v-for="(item, index) in batchStudents" :key="index" class="batch-student-item">
              <input 
                v-model="item.real_name" 
                type="text" 
                placeholder="请输入学生真实姓名"
                class="batch-input"
              />
              <button @click="removeBatchStudent(index)" class="btn-remove" title="删除">
                <Icon name="x" :size="18" />
              </button>
            </div>
          </div>
          <button @click="addBatchStudent" class="btn-add-student">
            <Icon name="plus" :size="18" />
            添加学生
          </button>
          <div class="dialog-actions">
            <button type="button" @click="closeBatchCreateDialog" class="btn-secondary">
              取消
            </button>
            <button 
              @click="batchCreateStudents" 
              class="btn-primary" 
              :disabled="isBatchCreating || validBatchStudents.length === 0"
            >
              {{ isBatchCreating ? '创建中...' : `创建 ${validBatchStudents.length} 个学生` }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 成功消息弹窗 -->
    <SuccessMessageDialog 
      :visible="showSuccessDialog" 
      :message="successMessage"
      @close="closeSuccessDialog"
    />
    
    <!-- 确认对话框 -->
    <ConfirmDialog 
      :visible="showConfirmDialog"
      :title="confirmTitle"
      :message="confirmMessage"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
    
    <!-- 学生详情对话框 -->
    <div v-if="showStudentDetailDialog && selectedStudent" class="dialog-overlay" @click="closeStudentDetailDialog">
      <div class="dialog dialog-large" @click.stop>
        <div class="dialog-header">
          <h3>学生详情</h3>
          <button @click="closeStudentDetailDialog" class="btn-close">&times;</button>
          </div>
        <div class="dialog-body">
          <div class="student-detail-content">
            <div class="student-detail-header">
              <div class="student-avatar-large">
                {{ selectedStudent.real_name ? selectedStudent.real_name.charAt(0) : selectedStudent.username.charAt(0) }}
                  </div>
              <div class="student-detail-info">
                <h2 class="student-detail-name">{{ selectedStudent.real_name || selectedStudent.username }}</h2>
                <p class="student-detail-username">{{ selectedStudent.username }}</p>
                <p v-if="selectedStudent.email" class="student-detail-email">{{ selectedStudent.email }}</p>
              </div>
            </div>
            
            <div class="student-detail-stats">
              <div class="stat-card">
                <Icon name="bar-chart-3" :size="32" class="stat-icon" />
                <div class="stat-content">
                  <div class="stat-number">{{ selectedStudent.total_submissions || 0 }}</div>
                  <div class="stat-label">总提交次数</div>
                  </div>
                    </div>
              <div class="stat-card">
                <Icon name="check-circle" :size="32" class="stat-icon" />
                <div class="stat-content">
                  <div class="stat-number">{{ selectedStudent.accuracy_rate || 0 }}%</div>
                  <div class="stat-label">正确率</div>
                    </div>
                  </div>
              <div class="stat-card">
                <Icon name="target" :size="32" class="stat-icon" />
                <div class="stat-content">
                  <div class="stat-number">{{ selectedStudent.completed_exams || 0 }}</div>
                  <div class="stat-label">完成考试</div>
                </div>
              </div>
            </div>
            
            <div class="student-detail-actions">
              <button @click="closeStudentDetailDialog" class="btn-secondary">
                关闭
              </button>
              <button @click="resetStudentPassword(selectedStudent.id)" class="btn-warning">
                重置密码
              </button>
              <button @click="unbindStudent(selectedStudent.id)" class="btn-danger">
                解除绑定
              </button>
          </div>
          </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 考试学生详情对话框 -->
    <div v-if="showExamStudentsDialog && selectedExam" class="dialog-overlay" @click="closeExamStudentsDialog">
      <div class="dialog dialog-large" @click.stop>
        <div class="dialog-header">
          <h3>{{ selectedExam.name }} - 学生提交情况</h3>
          <button @click="closeExamStudentsDialog" class="btn-close">&times;</button>
        </div>
        <div class="dialog-body">
          <div v-if="examStudentsLoading" class="loading">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else class="exam-students-content">
            <!-- 考试信息摘要 -->
            <div class="exam-summary">
              <div class="summary-card">
                <div class="summary-item">
                  <span class="summary-label">总学生数:</span>
                  <span class="summary-value">{{ examStudents.length }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">已提交:</span>
                  <span class="summary-value">{{ submittedCount }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">未提交:</span>
                  <span class="summary-value">{{ notSubmittedCount }}</span>
                </div>
              </div>
            </div>
            
            <!-- 学生列表 -->
            <div class="students-submission-list">
              <h4>已提交学生详情 ({{ submittedStudents.length }}人)</h4>
              <div class="students-list">
                <div 
                  v-for="student in submittedStudents" 
                  :key="student.student_id"
                  class="student-submission-item"
                  :class="{ 'submitted': student.submission_status === 'submitted' }"
                  @click="showStudentWrongQuestions(student)"
                >
                  <div class="student-submission-info">
                    <div class="student-avatar-small">
                      {{ student.real_name ? student.real_name.charAt(0) : student.username.charAt(0) }}
                    </div>
                    <div class="student-submission-details">
                      <h5>{{ student.real_name || student.username }}</h5>
                      <p>{{ student.username }}</p>
                      <div class="submission-status">
                        <span v-if="student.submission_status === 'submitted'" class="status-badge submitted">
                          已提交
                        </span>
                        <span v-else class="status-badge not-submitted">
                          未提交
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="student.submission_status === 'submitted' && student.submission_info" class="submission-details">
                    <div class="submission-info">
                      <div class="info-item">
                        <span class="info-label">得分:</span>
                        <span class="info-value score">{{ student.submission_info.score || 0 }}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">提交时间:</span>
                        <span class="info-value">{{ student.submission_info.submit_time || '未知' }}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">尝试次数:</span>
                        <span class="info-value">{{ student.submission_info.attempt_number || 1 }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 学生提交详情对话框 -->
    <div v-if="showStudentSubmissionDetail && selectedStudentSubmission && studentSubmissionHistory" class="dialog-overlay" @click="closeStudentSubmissionDetail">
      <div class="dialog dialog-large" @click.stop>
        <div class="dialog-header">
          <h3>{{ selectedStudentSubmission.real_name || selectedStudentSubmission.username }} - 错题分析</h3>
          <button @click="closeStudentSubmissionDetail" class="btn-close">&times;</button>
        </div>
        <div class="dialog-body">
          <div v-if="studentSubmissionLoading" class="loading">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else class="submission-detail-content">
            <!-- 考试信息 -->
            <div class="exam-info-section">
              <h4>考试信息</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">考试名称:</span>
                  <span class="info-value">{{ studentSubmissionHistory.exam_info.name }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">考试级别:</span>
                  <span class="info-value">{{ studentSubmissionHistory.exam_info.level }}级</span>
                </div>
                <div class="info-row">
                  <span class="info-label">总题数:</span>
                  <span class="info-value">{{ studentSubmissionHistory.exam_info.total_questions }}</span>
                </div>
              </div>
            </div>
            
            <!-- 学生信息 -->
            <div class="student-info-section">
              <h4>学生信息</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">用户名:</span>
                  <span class="info-value">{{ studentSubmissionHistory.student_info.username }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">真实姓名:</span>
                  <span class="info-value">{{ studentSubmissionHistory.student_info.real_name }}</span>
                </div>
              </div>
            </div>
            
            <!-- 统计信息 -->
            <div class="statistics-section">
              <h4>错题统计</h4>
              <div class="statistics-grid">
                <div class="stat-card">
                  <Icon name="bar-chart-3" :size="32" class="stat-icon" />
                  <div class="stat-content">
                    <div class="stat-number">{{ studentSubmissionHistory.statistics.total_attempts }}</div>
                    <div class="stat-label">总尝试次数</div>
                  </div>
                </div>
                <div class="stat-card">
                  <Icon name="x-circle" :size="32" class="stat-icon" />
                  <div class="stat-content">
                    <div class="stat-number">{{ studentSubmissionHistory.statistics.total_wrong_questions }}</div>
                    <div class="stat-label">错题数量</div>
                  </div>
                </div>
                <div class="stat-card">
                  <Icon name="trending-up" :size="32" class="stat-icon" />
                  <div class="stat-content">
                    <div class="stat-number">{{ Math.round((studentSubmissionHistory.statistics.total_wrong_questions / studentSubmissionHistory.exam_info.total_questions) * 100) }}%</div>
                    <div class="stat-label">错误率</div>
                  </div>
                </div>
                <div class="stat-card">
                  <Icon name="check-circle" :size="32" class="stat-icon" />
                  <div class="stat-content">
                    <div class="stat-number">{{ studentSubmissionHistory.exam_info.total_questions - studentSubmissionHistory.statistics.total_wrong_questions }}</div>
                    <div class="stat-label">正确题数</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 错题列表 -->
            <div class="wrong-questions-section">
              <h4>错题详情 ({{ studentSubmissionHistory.wrong_questions.length }}题)</h4>
              <div class="wrong-questions-list">
                <div 
                  v-for="(question, index) in studentSubmissionHistory.wrong_questions" 
                  :key="question.question_id"
                  class="wrong-question-item"
                >
                  <div class="question-header">
                    <div class="question-number">
                      <span class="question-label">第 {{ index + 1 }} 题</span>
                      <span class="question-id">(ID: {{ question.question_id }})</span>
                    </div>
                    <div class="question-meta">
                      <span class="difficulty-badge" :class="question.difficulty">{{ question.difficulty }}</span>
                      <span class="level-badge">{{ question.level }}级</span>
                    </div>
                  </div>
                  
                  <div class="question-content">
                    <div class="question-text">{{ question.question_text }}</div>
                  </div>
                  
                  <div class="answer-section">
                    <div class="answer-row">
                      <span class="answer-label">学生答案:</span>
                      <span class="student-answer wrong">{{ question.user_answer }}</span>
                    </div>
                    <div class="answer-row">
                      <span class="answer-label">正确性:</span>
                      <span class="correctness wrong"><Icon name="x" :size="14" /> 错误</span>
                    </div>
                  </div>
                  
                  <div class="explanation-section" v-if="question.explanation">
                    <div class="explanation-label">解析:</div>
                    <div class="explanation-text">{{ question.explanation }}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="dialog-actions">
              <button @click="closeStudentSubmissionDetail" class="btn-secondary">
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 侧边栏 - 右侧 -->
    <aside class="sidebar">
      <nav class="sidebar-nav">
        <button 
          v-for="item in menuItems" 
          :key="item.key"
          :class="['nav-item', { active: currentActiveSection === item.key }]"
          @click="openSection(item.key)"
        >
          {{ item.label }}
        </button>
      </nav>
    </aside>
  </template>
  
  <script setup lang="ts">import { BASE_URL } from '@/config/api'
import { pinyin } from 'pinyin-pro'

import { ref, onMounted, onUnmounted, watch, reactive, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
  import axios from 'axios'
import SuccessMessageDialog from '@/components/admin/Dialog/SuccessMessageDialog.vue'
import ConfirmDialog from '@/components/admin/Dialog/ConfirmDialog.vue'
import ObjectiveSubmissionsSection from '@/components/teacher/ObjectiveSubmissionsSection.vue'
import OJSubmissionsSection from '@/components/teacher/OJSubmissionsSection.vue'
import StudentManagementSection from '@/components/teacher/StudentManagementSection.vue'
import StudentPlanProgressPanel from '@/components/teacher/StudentPlanProgressPanel.vue'
import StudentPlanManagementPanel from '@/components/teacher/StudentPlanManagementPanel.vue'
import AdminTestManagementSection from '@/components/admin/AdminTestManagementSection.vue'
import Icon from '@/components/Icon.vue'
  
  // 路由
  const router = useRouter()
  const route = useRoute()
  
  // 响应式数据
  const userInfo = ref<any>(null)
  
  // 学生管理相关数据
  const students = ref<any[]>([])
  const studentsLoading = ref(false)
  const showCreateStudentDialog = ref(false)
  const showBindStudentDialog = ref(false)
  const showBatchCreateDialog = ref(false)
  const isCreatingStudent = ref(false)
  const isBindingStudent = ref(false)
  const isBatchCreating = ref(false)
  const availableStudents = ref<any[]>([])
  const selectedStudentIds = ref<number[]>([])
  const bindStudentSearchQuery = ref('')
  const bindStudentClassNo = ref('')
  const batchClassNo = ref('')
  const batchStudents = ref<{real_name: string}[]>([{ real_name: '' }])
  
  // 成功消息弹窗
  const showSuccessDialog = ref(false)
  const successMessage = ref('')
  
  // 确认对话框
  const showConfirmDialog = ref(false)
  const confirmTitle = ref('')
  const confirmMessage = ref('')
  const confirmAction = ref<(() => void) | null>(null)
  
  // 学生详情对话框
  const showStudentDetailDialog = ref(false)
  const selectedStudent = ref<any>(null)
  
  // 学生计划完成面板
  const selectedStudentForPlanProgress = ref<any>(null)
  
  // 学生计划管理面板
  const selectedStudentForPlanManagement = ref<any>(null)
  
  // 当前激活的页面
  const currentActiveSection = ref<string>('')
  
  // 学生提交相关数据
  const exams = ref<any[]>([])
  const examsLoading = ref(false)
  const selectedExam = ref<any>(null)
  const examStudents = ref<any[]>([])
  const examStudentsLoading = ref(false)
  const showExamStudentsDialog = ref(false)
  // 考级筛选 - 从 localStorage 恢复状态
  const getInitialSelectedLevel = () => {
    const saved = localStorage.getItem('teacherView_selectedLevel')
    if (!saved || saved === 'null') return null
    const num = Number(saved)
    return isNaN(num) ? saved : num
  }
  const selectedLevel = ref<number | string | null>(getInitialSelectedLevel())
  
  // 学生提交详情相关数据
  const showStudentSubmissionDetail = ref(false)
  const selectedStudentSubmission = ref<any>(null)
  const studentSubmissionHistory = ref<any>(null)
  const studentSubmissionLoading = ref(false)
  
  // OJ提交相关数据
  const ojProblems = ref<any[]>([])
  const ojProblemsLoading = ref(false)
  const selectedOJLevel = ref<number | string | null>(null)
  
  // 新学生表单数据
  const newStudent = reactive({
    username: '',
    password: '',
    email: '',
    real_name: '',
    class_no: '',
    role_id: 2 // 学生角色
  })
  
  // 自动绑定选项
  const autoBindStudent = ref(true)
  
  // 侧边栏菜单项
  const menuItems = [
    { key: 'student-management', label: '学生管理' },
    { key: 'objective-submissions', label: '客观题提交' },
    { key: 'oj-submissions', label: 'OJ提交' },
    { key: 'my-tests', label: '测试管理' }
  ]

  // 从侧边栏打开页面
  function openSection(sectionKey: string) {
    // 切换到该页面
    currentActiveSection.value = sectionKey
    
    // 保存状态
    saveCurrentState()
    
    // 根据不同的section触发相应的数据加载
    if (sectionKey === 'student-management' && userInfo.value) {
      fetchStudents()
    }
    // 注意：objective-submissions 和 oj-submissions 的数据加载已移到各自的组件中
  }
  
  // 过滤后的可绑定学生列表
  const filteredAvailableStudents = computed(() => {
    if (!bindStudentSearchQuery.value.trim()) {
      return availableStudents.value
    }
    
    const query = bindStudentSearchQuery.value.toLowerCase().trim()
    return availableStudents.value.filter(student => {
      const username = (student.username || '').toLowerCase()
      const realName = (student.real_name || '').toLowerCase()
      const email = (student.email || '').toLowerCase()
      return username.includes(query) || realName.includes(query) || email.includes(query)
    })
  })
  
  // 过滤后的考试列表
  const filteredExams = computed(() => {
    if (selectedLevel.value === null || selectedLevel.value === '') {
      return exams.value
    }
    return exams.value.filter(exam => exam.level === selectedLevel.value)
  })
  
  // 已提交学生数量
  const submittedCount = computed(() => {
    return examStudents.value.filter(student => student.submission_status === 'submitted').length
  })
  
  // 未提交学生数量
  const notSubmittedCount = computed(() => {
    return examStudents.value.filter(student => student.submission_status === 'not_submitted').length
  })
  
  // 已提交学生列表（只显示已提交的学生）
  const submittedStudents = computed(() => {
    return examStudents.value.filter(student => student.submission_status === 'submitted')
  })
  
  // 有效的批量学生（过滤空姓名）
  const validBatchStudents = computed(() => {
    return batchStudents.value.filter(s => s.real_name.trim())
  })
  
  // 获取用户信息
  const getUserInfo = () => {
    const userInfoStr = localStorage.getItem('userInfo')
    if (userInfoStr) {
      userInfo.value = JSON.parse(userInfoStr)
    }
  }
  
  // 显示成功消息
  const showSuccess = (message: string) => {
    successMessage.value = message
    showSuccessDialog.value = true
  }
  
  // 关闭成功消息弹窗
  const closeSuccessDialog = () => {
    showSuccessDialog.value = false
  }
  
  // 显示确认对话框
  const showConfirm = (title: string, message: string, action: () => void) => {
    confirmTitle.value = title
    confirmMessage.value = message
    confirmAction.value = action
    showConfirmDialog.value = true
  }
  
  // 确认操作
  const handleConfirm = () => {
    if (confirmAction.value) {
      confirmAction.value()
    }
    showConfirmDialog.value = false
    confirmAction.value = null
  }
  
  // 学生管理：重置密码（先确认再调用接口）
  const handleResetPassword = (student: any) => {
    showConfirm(
      '确认重置密码',
      `确定要重置学生「${student.real_name || student.username}」的密码吗？密码将重置为 123456。`,
      () => { resetStudentPassword(student.id) }
    )
  }
  
  // 取消操作
  const handleCancel = () => {
    showConfirmDialog.value = false
    confirmAction.value = null
  }
  
  // 显示学生计划完成面板
  const showStudentPlanProgress = (student: any) => {
    // 如果已经打开了计划管理面板，先关闭它
    if (selectedStudentForPlanManagement.value) {
      selectedStudentForPlanManagement.value = null
    }
    selectedStudentForPlanProgress.value = student
  }
  
  // 关闭学生计划完成面板
  const closeStudentPlanProgress = () => {
    selectedStudentForPlanProgress.value = null
  }
  
  // 显示学生计划管理面板
  const showStudentPlanManagement = (student: any) => {
    // 如果已经打开了计划完成面板，先关闭它
    if (selectedStudentForPlanProgress.value) {
      selectedStudentForPlanProgress.value = null
    }
    selectedStudentForPlanManagement.value = student
  }
  
  // 关闭学生计划管理面板
  const closeStudentPlanManagement = () => {
    selectedStudentForPlanManagement.value = null
  }
  
  // 处理计划更新
  const handlePlanUpdated = () => {
    // 可以在这里刷新学生列表或其他相关数据
    if (currentActiveSection.value === 'student-management' && userInfo.value) {
      fetchStudents()
    }
  }
  
  // 处理更新学生班级
  const handleUpdateClass = async (student: any, classNo: string | null) => {
    if (!userInfo.value) return
    try {
      await axios.put(`${BASE_URL}/teacher/${userInfo.value.id}/students/${student.id}/class`, {
        class_no: classNo
      })
      await fetchStudents()
      showSuccess('班级更新成功！')
    } catch (error: any) {
      console.error('更新班级失败:', error)
      alert('更新班级失败: ' + (error.response?.data?.error || error.message))
    }
  }
  
  // 处理解除绑定学生
  const handleUnbindStudent = (student: any) => {
    if (!userInfo.value) return
    
    showConfirm(
      '解除绑定',
      `确定要解除与学生 "${student.real_name || student.username}" 的绑定关系吗？`,
      () => {
        performUnbindStudent(student.id)
      }
    )
  }
  
  // 显示学生详情（保留原有功能，用于其他场景）
  const showStudentDetail = (student: any) => {
    selectedStudent.value = student
    showStudentDetailDialog.value = true
  }
  
  // 关闭学生详情对话框
  const closeStudentDetailDialog = () => {
    showStudentDetailDialog.value = false
    selectedStudent.value = null
  }
  

  // 获取教师的学生列表
  const fetchStudents = async () => {
    if (!userInfo.value) {
      console.log('用户信息未加载，跳过获取学生列表')
      return
    }
    
    console.log('开始获取学生列表，教师ID:', userInfo.value.id)
    studentsLoading.value = true
    try {
      const response = await axios.get(`${BASE_URL}/teacher/${userInfo.value.id}/students`)
      console.log('获取学生列表API响应:', response.data)
      
      // 处理不同的响应格式
      let studentList = []
      if (response.data.data?.students) {
        studentList = response.data.data.students
      } else if (response.data.students) {
        studentList = response.data.students
      } else if (Array.isArray(response.data.data)) {
        studentList = response.data.data
      } else if (Array.isArray(response.data)) {
        studentList = response.data
      }
      
      students.value = studentList
      console.log('学生列表更新完成，学生数量:', studentList.length)
    } catch (error: any) {
      console.error('获取学生列表失败:', error)
      console.error('错误详情:', error.response?.data)
      alert('获取学生列表失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
    } finally {
      studentsLoading.value = false
    }
  }
  
  // 处理绑定学生按钮点击
  const handleBindStudent = () => {
    showBindStudentDialog.value = true
    fetchAvailableStudents()
  }
  
  // 获取可绑定的学生列表（未绑定的学生）
  const fetchAvailableStudents = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/users`, {
        params: {
          role_id: 2, // 只获取学生角色
          limit: 100
        }
      })
      const allStudents = response.data || []
      // 过滤掉已经绑定的学生
      const boundStudentIds = students.value.map(s => s.id)
      availableStudents.value = allStudents.filter((student: any) => !boundStudentIds.includes(student.id))
    } catch (error: any) {
      console.error('获取可绑定学生列表失败:', error)
      alert('获取可绑定学生列表失败: ' + (error.response?.data?.error || error.message))
    }
  }
  
  // 创建学生
  const createStudent = async () => {
    isCreatingStudent.value = true
    try {
      // 准备学生数据，确保role_id为2（普通用户）
      const studentData = {
        ...newStudent,
        role_id: 2 // 学生角色固定为普通用户
      }
      
      console.log('开始创建学生，数据:', studentData)
      
      // 第一步：创建学生
      const response = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(studentData)
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('创建学生API响应:', result)
        
        // 第二步：获取学生ID
        console.log('完整API响应结构:', JSON.stringify(result, null, 2))
        
        // 尝试多种可能的学生ID字段（参考用户管理的逻辑）
        const studentId = result.id || 
                         result.data?.id || 
                         result.data?.user_id || 
                         result.user_id ||
                         result.user?.id ||
                         result.data?.user?.id
        
        console.log('创建学生成功，学生ID:', studentId, '完整响应:', result)
        
        if (studentId) {
          const classNoForBind = newStudent.class_no?.trim() || undefined
          // 关闭对话框和重置表单
          closeCreateStudentDialog()
          resetNewStudent()
          
          if (autoBindStudent.value) {
            console.log('开始自动绑定学生，ID:', studentId)
            
            // 第三步：绑定学生到教师（含班级编号）
            try {
              const bindPayload: { student_ids: number[]; class_no?: string } = { student_ids: [studentId] }
              if (classNoForBind) bindPayload.class_no = classNoForBind
              const bindResponse = await axios.post(`${BASE_URL}/teacher/${userInfo.value.id}/students`, bindPayload)
              
              console.log('绑定学生API响应:', bindResponse.data)
              
              // 检查绑定是否成功
              if (bindResponse.data.success === true || 
                  bindResponse.data.message?.includes('绑定') || 
                  bindResponse.data.message?.includes('成功') ||
                  bindResponse.status === 200) {
                
                // 第四步：刷新学生列表
                await fetchStudents()
                console.log('学生创建并绑定成功')
                
                // 显示成功消息
                setTimeout(() => {
                  showSuccess('学生创建并绑定成功！')
                }, 100)
              } else {
                console.error('绑定学生失败:', bindResponse.data)
                alert('学生创建成功，但绑定失败: ' + (bindResponse.data.message || '未知错误'))
              }
            } catch (bindError: any) {
              console.error('绑定学生出错:', bindError)
              // 检查是否是网络错误但实际操作成功的情况
              if (bindError.response?.data?.message?.includes('绑定') || 
                  bindError.response?.data?.message?.includes('成功')) {
                await fetchStudents()
                console.log('学生自动绑定成功（网络错误但操作成功）')
                
                setTimeout(() => {
                  showSuccess('学生创建并绑定成功！')
                }, 100)
              } else {
                alert('学生创建成功，但绑定失败: ' + (bindError.response?.data?.error || bindError.response?.data?.message || bindError.message))
              }
            }
          } else {
            console.log('用户选择不自动绑定，只创建学生账户')
            // 显示成功消息
            setTimeout(() => {
              showSuccess('学生创建成功！')
            }, 100)
          }
        } else {
          console.error('无法获取学生ID')
          alert('学生创建成功，但无法获取学生ID')
        }
      } else {
        const error = await response.json()
        console.error('创建学生失败:', error)
        alert('创建学生失败: ' + (error.message || '未知错误'))
      }
    } catch (error: any) {
      console.error('创建学生出错:', error)
      alert('创建学生出错: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      // 确保无论成功还是失败都重置创建状态
      isCreatingStudent.value = false
    }
  }
  
  // 绑定学生
  const bindStudents = async (studentIds: number[]) => {
    if (!userInfo.value) return
    
    isBindingStudent.value = true
    try {
      const classNo = bindStudentClassNo.value.trim() || undefined
      const response = await axios.post(`${BASE_URL}/teacher/${userInfo.value.id}/students`, {
        student_ids: studentIds,
        ...(classNo && { class_no: classNo })
      })
      
      console.log('绑定学生API响应:', response.data)
      
      // 检查多种可能的成功响应格式
      if (response.data.success === true || 
          response.data.message?.includes('绑定') || 
          response.data.message?.includes('成功') ||
          response.status === 200) {
        await fetchStudents()
        showSuccess('学生绑定成功！')
      } else {
        alert('绑定学生失败: ' + (response.data.message || '未知错误'))
      }
    } catch (error: any) {
      console.error('绑定学生失败:', error)
      // 检查是否是网络错误但实际操作成功的情况
      if (error.response?.data?.message?.includes('绑定') || 
          error.response?.data?.message?.includes('成功')) {
        await fetchStudents()
        showSuccess('学生绑定成功！')
      } else {
        alert('绑定学生失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
      }
    } finally {
      isBindingStudent.value = false
    }
  }
  
  // 静默绑定学生（不显示成功消息，用于创建学生后的自动绑定）
  const bindStudentsSilently = async (studentIds: number[]) => {
    if (!userInfo.value) return
    
    try {
      const response = await axios.post(`${BASE_URL}/teacher/${userInfo.value.id}/students`, {
        student_ids: studentIds
      })
      
      console.log('静默绑定学生API响应:', response.data)
      
      // 检查多种可能的成功响应格式
      if (response.data.success === true || 
          response.data.message?.includes('绑定') || 
          response.data.message?.includes('成功') ||
          response.status === 200) {
        await fetchStudents()
        console.log('学生自动绑定成功')
      } else {
        console.error('学生自动绑定失败: ' + (response.data.message || '未知错误'))
      }
    } catch (error: any) {
      console.error('学生自动绑定失败:', error)
      // 检查是否是网络错误但实际操作成功的情况
      if (error.response?.data?.message?.includes('绑定') || 
          error.response?.data?.message?.includes('成功')) {
        await fetchStudents()
        console.log('学生自动绑定成功（网络错误但操作成功）')
      } else {
        console.error('学生自动绑定失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
      }
    }
  }
  
  // 重置学生密码
  const resetStudentPassword = async (studentId: number) => {
    try {
      const response = await fetch(`${BASE_URL}/users/${studentId}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_user_id: userInfo.value?.id
        })
      })
      
      if (response.ok) {
        showSuccess('密码重置成功！新密码为: 123456')
      } else {
        const error = await response.json()
        alert('重置密码失败: ' + (error.message || '未知错误'))
      }
    } catch (error: any) {
      console.error('重置密码失败:', error)
      alert('重置密码失败: ' + error.message)
    }
  }
  
  // 解绑学生
  const unbindStudent = async (studentId: number) => {
    if (!userInfo.value) return
    
    // 直接执行解绑操作
    await performUnbindStudent(studentId)
  }
  
  // 执行解绑学生操作
  const performUnbindStudent = async (studentId: number) => {
    try {
      const response = await axios.delete(`${BASE_URL}/teacher/${userInfo.value.id}/students/${studentId}`)
      
      console.log('解绑学生API响应:', response.data)
      
      // 检查多种可能的成功响应格式
      if (response.data.success === true || 
          response.data.message?.includes('解绑') || 
          response.data.message?.includes('成功') ||
          response.status === 200) {
        await fetchStudents()
        showSuccess('学生解绑成功！')
      } else {
        alert('解绑学生失败: ' + (response.data.message || '未知错误'))
      }
    } catch (error: any) {
      console.error('解绑学生失败:', error)
      // 检查是否是网络错误但实际操作成功的情况
      if (error.response?.data?.message?.includes('解绑') || 
          error.response?.data?.message?.includes('成功')) {
        await fetchStudents()
        showSuccess('学生解绑成功！')
      } else {
        alert('解绑学生失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
      }
    }
  }
  
  // 关闭创建学生对话框
  const closeCreateStudentDialog = () => {
    showCreateStudentDialog.value = false
    resetNewStudent()
  }
  
  // 关闭绑定学生对话框
  const closeBindStudentDialog = () => {
    showBindStudentDialog.value = false
    selectedStudentIds.value = []
    bindStudentSearchQuery.value = ''
    bindStudentClassNo.value = ''
  }
  
  // 关闭批量创建对话框
  const closeBatchCreateDialog = () => {
    showBatchCreateDialog.value = false
    batchStudents.value = [{ real_name: '' }]
    batchClassNo.value = ''
  }
  
  // 添加批量学生
  const addBatchStudent = () => {
    batchStudents.value.push({ real_name: '' })
  }
  
  // 移除批量学生
  const removeBatchStudent = (index: number) => {
    if (batchStudents.value.length > 1) {
      batchStudents.value.splice(index, 1)
    }
  }
  
  // 汉字转拼音（使用 pinyin-pro 库）
  const toPinyin = (name: string): string => {
    return pinyin(name, { toneType: 'none', type: 'array' }).join('').toLowerCase()
  }
  
  // 生成用户名
  const generateUsername = (realName: string): string => {
    const pinyin = toPinyin(realName)
    const randomNum = Math.floor(Math.random() * 90 + 10) // 10-99
    return `${pinyin}${randomNum}`
  }
  
  // 批量创建学生
  const batchCreateStudents = async () => {
    if (validBatchStudents.value.length === 0) return
    
    isBatchCreating.value = true
    const results: { name: string; success: boolean; username?: string; error?: string }[] = []
    
    try {
      for (const student of validBatchStudents.value) {
        const username = generateUsername(student.real_name)
        const studentData = {
          username,
          password: '123456',
          real_name: student.real_name,
          role_id: 2
        }
        
        try {
          const response = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(studentData)
          })
          
          if (response.ok) {
            const result = await response.json()
            const studentId = result.id || result.data?.id || result.user_id
            
            // 自动绑定到教师（含班级编号）
            if (studentId && userInfo.value) {
              const bindPayload: { student_ids: number[]; class_no?: string } = { student_ids: [studentId] }
              if (batchClassNo.value.trim()) bindPayload.class_no = batchClassNo.value.trim()
              await axios.post(`${BASE_URL}/teacher/${userInfo.value.id}/students`, bindPayload)
            }
            
            results.push({ name: student.real_name, success: true, username })
          } else {
            const error = await response.json()
            results.push({ name: student.real_name, success: false, error: error.message })
          }
        } catch (err: any) {
          results.push({ name: student.real_name, success: false, error: err.message })
        }
      }
      
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      let message = `批量创建完成！成功: ${successCount}`
      if (failCount > 0) {
        message += `，失败: ${failCount}`
      }
      
      // 显示详细结果
      const successList = results.filter(r => r.success).map(r => `${r.name}(${r.username})`).join('、')
      if (successList) {
        message += `\n\n成功创建: ${successList}\n初始密码: 123456`
      }
      
      alert(message)
      closeBatchCreateDialog()
      await fetchStudents()
    } catch (error: any) {
      console.error('批量创建学生失败:', error)
      alert('批量创建学生失败: ' + error.message)
    } finally {
      isBatchCreating.value = false
    }
  }
  
  // 重置新学生表单
  const resetNewStudent = () => {
    newStudent.username = ''
    newStudent.password = ''
    newStudent.email = ''
    newStudent.real_name = ''
    newStudent.class_no = ''
    newStudent.role_id = 2
    autoBindStudent.value = true // 重置为默认选中状态
  }
  
  // 切换学生选择
  const toggleStudentSelection = (studentId: number) => {
    const index = selectedStudentIds.value.indexOf(studentId)
    if (index > -1) {
      selectedStudentIds.value.splice(index, 1)
    } else {
      selectedStudentIds.value.push(studentId)
    }
  }
  
  // 类型文本转换
  const getTypeText = (type: string) => {
    return type || '真题'
  }

  // 获取正确率等级样式
  function getAccuracyClass(accuracy: number) {
    if (accuracy >= 90) return 'excellent'
    if (accuracy >= 80) return 'good'
    if (accuracy >= 60) return 'pass'
    return 'fail'
  }
  
  // 计算通过率
  function getPassRate(problem: any) {
    if (!problem.total_submissions || problem.total_submissions === 0) return '0.0'
    const rate = (problem.accepted_submissions || 0) / problem.total_submissions * 100
    return rate.toFixed(1)
  }
  
  // 获取通过率样式类
  function getPassRateClass(problem: any) {
    const rate = parseFloat(getPassRate(problem))
    if (rate >= 80) return 'excellent'
    if (rate >= 60) return 'good'
    if (rate >= 40) return 'pass'
    return 'fail'
  }
  
  // 格式化日期
  function formatDate(dateString: string) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  // 处理考级筛选变化，保存状态
  function handleLevelChange() {
    // 保存筛选状态到 localStorage
    if (selectedLevel.value === null || selectedLevel.value === '') {
      localStorage.setItem('teacherView_selectedLevel', 'null')
    } else {
      localStorage.setItem('teacherView_selectedLevel', String(selectedLevel.value))
    }
    // 触发数据加载
    fetchExams()
  }

  // 获取考试列表
  const fetchExams = async () => {
    if (!userInfo.value) {
      console.log('用户信息未加载，跳过获取考试列表')
      return
    }
    
    console.log('开始获取考试列表')
    examsLoading.value = true
    try {
      const response = await axios.get(`${BASE_URL}/exams`, { params: { include_all: 1 } })
      console.log('获取考试列表API响应:', response.data)
      
      // 处理不同的响应格式
      let examList = []
      if (response.data.data?.exams) {
        examList = response.data.data.exams
      } else if (response.data.exams) {
        examList = response.data.exams
      } else if (Array.isArray(response.data.data)) {
        examList = response.data.data
      } else if (Array.isArray(response.data)) {
        examList = response.data
      }
      
      exams.value = examList
      console.log('考试列表更新完成，考试数量:', examList.length)
    } catch (error: any) {
      console.error('获取考试列表失败:', error)
      console.error('错误详情:', error.response?.data)
      alert('获取考试列表失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
    } finally {
      examsLoading.value = false
    }
  }
  
  // 获取OJ题目列表
  const fetchOJProblems = async () => {
    if (!userInfo.value) {
      console.log('用户信息未加载，跳过获取OJ题目列表')
      return
    }
    
    console.log('开始获取OJ题目列表')
    ojProblemsLoading.value = true
    try {
      const params: any = {
        page: 1,
        pageSize: 1000
      }
      
      if (selectedOJLevel.value) {
        params.level = selectedOJLevel.value
      }
      params.include_all = 1
      const response = await axios.get(`${BASE_URL}/oj/problems`, { params })
      console.log('获取OJ题目列表API响应:', response.data)
      
      if (response.data.success) {
        ojProblems.value = response.data.data || []
        console.log('OJ题目列表更新完成，题目数量:', ojProblems.value.length)
      } else {
        ojProblems.value = []
      }
    } catch (error: any) {
      console.error('获取OJ题目列表失败:', error)
      console.error('错误详情:', error.response?.data)
      alert('获取OJ题目列表失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
      ojProblems.value = []
    } finally {
      ojProblemsLoading.value = false
    }
  }
  
  // 处理OJ级别筛选变化
  function handleOJLevelChange() {
    fetchOJProblems()
  }
  
  // 过滤后的OJ题目列表
  const filteredOJProblems = computed(() => {
    if (selectedOJLevel.value === null || selectedOJLevel.value === '') {
      return ojProblems.value
    }
    return ojProblems.value.filter(problem => problem.level === selectedOJLevel.value)
  })
  
  // 查看OJ题目提交记录
  function showOJProblemSubmissions(problem: any) {
    if (!userInfo.value) {
      console.log('用户信息未加载，无法跳转')
      return
    }
    
    // 保存当前状态到 localStorage
    saveCurrentState()
    
    // 跳转到 TeacherOJSubmissionsView，传递 teacherId 和 problemId
    router.push({
      path: `/teacher/${userInfo.value.id}/oj-submissions/${problem.id}`,
      query: { 
        fromSection: currentActiveSection.value,
        fromTeacherView: 'true'
      }
    })
  }
  
  // 显示考试学生详情 - 跳转到 StudentSubmissionsView
  const showExamStudents = (exam: any) => {
    if (!userInfo.value) {
      console.log('用户信息未加载，无法跳转')
      return
    }
    
    // 保存当前状态到 localStorage
    saveCurrentState()
    
    // 跳转到 StudentSubmissionsView，传递 exam_id 作为查询参数
    router.push({
      path: `/teacher/${userInfo.value.id}/submissions`,
      query: { 
        exam_id: exam.id.toString(),
        fromSection: currentActiveSection.value,
        fromTeacherView: 'true'
      }
    })
  }
  
  // 保存当前状态到 localStorage
  function saveCurrentState() {
    if (currentActiveSection.value) {
      localStorage.setItem('teacherView_activeSection', currentActiveSection.value)
    }
  }
  
  // 恢复状态
  function restoreState() {
    // 如果已经有打开的页面，不重复恢复
    if (currentActiveSection.value) {
      console.log('已有打开的页面，跳过状态恢复')
      return
    }
    
    // 优先从路由查询参数恢复
    const fromSection = route.query.fromSection as string
    if (fromSection) {
      console.log('从路由查询参数恢复状态:', fromSection)
      openSection(fromSection)
      return
    }
    
    // 从 localStorage 恢复
    const savedSection = localStorage.getItem('teacherView_activeSection')
    
    if (savedSection) {
      console.log('从 localStorage 恢复状态:', savedSection)
      openSection(savedSection)
    } else {
      // 默认打开学生管理页面
      openSection('student-management')
    }
  }
  
  // 获取考试学生提交情况
  const fetchExamStudents = async (examId: number) => {
    if (!userInfo.value) return
    
    console.log('开始获取考试学生提交情况，考试ID:', examId)
    examStudentsLoading.value = true
    try {
      const response = await axios.get(`${BASE_URL}/teacher/${userInfo.value.id}/exams/${examId}/students`)
      console.log('获取考试学生提交情况API响应:', response.data)
      
      // 处理响应数据
      let studentList = []
      if (response.data.students) {
        studentList = response.data.students
      } else if (response.data.data?.students) {
        studentList = response.data.data.students
      } else if (Array.isArray(response.data.data)) {
        studentList = response.data.data
      } else if (Array.isArray(response.data)) {
        studentList = response.data
      }
      
      // 确保每个学生对象都有正确的结构
      examStudents.value = studentList.map((student: any) => ({
        ...student,
        submission_info: student.submission_info || null,
        submission_status: student.submission_status || 'not_submitted'
      }))
      
      console.log('考试学生提交情况更新完成，学生数量:', examStudents.value.length)
    } catch (error: any) {
      console.error('获取考试学生提交情况失败:', error)
      console.error('错误详情:', error.response?.data)
      alert('获取考试学生提交情况失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
    } finally {
      examStudentsLoading.value = false
    }
  }
  
  
  // 关闭考试学生详情对话框
  const closeExamStudentsDialog = () => {
    showExamStudentsDialog.value = false
    selectedExam.value = null
    examStudents.value = []
  }
  
  // 显示学生错题详情
  const showStudentWrongQuestions = async (student: any) => {
    if (!userInfo.value || !selectedExam.value) return
    
    selectedStudentSubmission.value = student
    showStudentSubmissionDetail.value = true
    await fetchStudentWrongQuestions(student.student_id, selectedExam.value.id)
  }
  
  // 获取学生错题情况
  const fetchStudentWrongQuestions = async (studentId: number, examId: number) => {
    if (!userInfo.value) return
    
    console.log('开始获取学生错题情况，学生ID:', studentId, '考试ID:', examId)
    studentSubmissionLoading.value = true
    try {
      const response = await axios.get(`${BASE_URL}/teacher/${userInfo.value.id}/students/${studentId}/exams/${examId}/wrong-questions`)
      console.log('获取学生错题情况API响应:', response.data)
      
      studentSubmissionHistory.value = response.data
    } catch (error: any) {
      console.error('获取学生错题情况失败:', error)
      console.error('错误详情:', error.response?.data)
      alert('获取学生错题情况失败: ' + (error.response?.data?.error || error.response?.data?.message || error.message))
    } finally {
      studentSubmissionLoading.value = false
    }
  }
  
  // 关闭学生提交详情对话框
  const closeStudentSubmissionDetail = () => {
    showStudentSubmissionDetail.value = false
    selectedStudentSubmission.value = null
    studentSubmissionHistory.value = null
  }
  
  
  // 初始化时打开默认页面
  onMounted(() => {
    getUserInfo()
    // 恢复之前的状态或打开默认页面
    if (userInfo.value) {
      restoreState()
    }
    // 禁用整体页面滚动
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  })
  
  // 组件卸载时恢复页面滚动
  onUnmounted(() => {
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
  })
  
  // 监听用户信息变化，当用户信息加载完成后恢复状态
  watch(userInfo, (newUserInfo) => {
    if (newUserInfo && !currentActiveSection.value) {
      restoreState()
    }
  })
  
  // 监听路由变化，当从子页面返回时恢复状态
  watch(() => route.path, (newPath) => {
    // 如果返回到 /teacher 页面，且当前没有打开的子页面，则恢复状态
    if (newPath === '/teacher' && !currentActiveSection.value && userInfo.value) {
      restoreState()
    }
  })

  // 监听 selectedLevel 变化，自动保存状态
  watch(selectedLevel, (newLevel) => {
    if (newLevel === null || newLevel === '') {
      localStorage.setItem('teacherView_selectedLevel', 'null')
    } else {
      localStorage.setItem('teacherView_selectedLevel', String(newLevel))
    }
  })
  
  </script>
  
  <style scoped>
  /* 添加CSS变量定义，与AdminView保持一致 */
  :root {
    --primary-color: #1e90ff; /* 天蓝色 */
    --primary-dark: #0066cc; /* 深天蓝色 */
    --primary-light: #87ceeb; /* 浅天蓝色 */
    --secondary-color: #f59e0b;
    --success-color: #10b981;
    --error-color: #ef4444;
    --warning-color: #f59e0b;
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #f1f5f9;
    --text-primary: #1e293b;
    --text-secondary: #64748b;
    --text-tertiary: #94a3b8;
    --border-primary: #e2e8f0;
    --border-secondary: #cbd5e1;
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-5: 1.25rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
    --transition-normal: 250ms ease;
  }

  /* 统一背景为渐变，与PlanView一致 */
  .profile-layout {
    display: flex;
    flex-direction: row;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
    box-sizing: border-box;
    font-family: 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  }

  /* 侧边栏样式 - 右侧纵向布局 */
  .sidebar {
    width: 160px;
    height: calc(100% - 48px);
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    backdrop-filter: blur(10px);
    color: white;
    padding: 0;
    position: fixed;
    top: 48px;
    right: 0;
    bottom: 0;
    z-index: 10;
    box-shadow: -12px 0 40px rgba(30, 144, 255, 0.4);
    border-left: 6px solid #0c7cd5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 24px 0;
  }

  .sidebar-header {
    padding: 0;
    margin: 0;
    border: none;
    display: flex;
    align-items: center;
  }

  .sidebar-header h2 {
    margin: 0;
    color: white;
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 1px;
    white-space: nowrap;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: flex-start;
    padding: 0;
    width: 100%;
  }

  .nav-item {
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.2);
    border: 3px solid rgba(255, 255, 255, 0.3);
    color: white;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.5px;
    position: relative;
    margin: 0;
    border-radius: 12px;
    white-space: nowrap;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateX(-2px) scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    border-width: 4px;
  }

  .nav-item.active {
    background: rgba(255, 255, 255, 0.95);
    color: #1e90ff;
    font-weight: 900;
    box-shadow: 0 8px 24px rgba(255, 255, 255, 0.4);
    border-color: white;
    border-width: 4px;
    transform: translateX(-2px) scale(1.05);
  }

  .nav-item.active::before {
    display: none;
  }

  .main-content {
    flex: 1;
    margin-left: 0;
    margin-right: 160px; /* 为右侧侧边栏留出空间 */
    padding: 0;
    background: transparent;
    min-height: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* 通用章节包装器 - 支持滚动 */
  .section-wrapper {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 40px 3vw;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(30, 144, 255, 0.3) transparent;
  }

  .section-wrapper::-webkit-scrollbar {
    width: 8px;
  }

  .section-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  .section-wrapper::-webkit-scrollbar-thumb {
    background: rgba(30, 144, 255, 0.3);
    border-radius: 4px;
  }

  .section-wrapper::-webkit-scrollbar-thumb:hover {
    background: rgba(30, 144, 255, 0.5);
  }

  /* 学生管理包装器 - 支持展开面板 */
  .student-management-wrapper {
    display: flex;
    gap: 0;
    width: 100%;
    flex: 1;
    min-height: 0;
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .student-management-wrapper.has-panel {
    gap: 0;
  }

  .student-management-main {
    flex: 1;
    transition: all 0.3s ease;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 6px 10px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    -webkit-overflow-scrolling: touch;
  }

  .student-management-main::-webkit-scrollbar {
    width: 8px;
  }

  .student-management-main::-webkit-scrollbar-track {
    background: transparent;
  }

  .student-management-main::-webkit-scrollbar-thumb {
    background: rgba(30, 144, 255, 0.3);
    border-radius: 4px;
  }

  .student-management-main::-webkit-scrollbar-thumb:hover {
    background: rgba(30, 144, 255, 0.5);
  }

  .student-management-wrapper.has-panel .student-management-main {
    flex: 0 0 50%;
    max-width: 50%;
  }
  
  /* 确保两个面板可以同时存在时，主内容区域进一步缩小 */
  .student-management-wrapper.has-panel:has(.student-plan-progress-panel):has(.student-plan-management-panel) .student-management-main {
    flex: 0 0 33.33%;
    max-width: 33.33%;
  }


  .content-section {
    background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
    padding: 32px 24px;
    border-radius: 24px;
    box-shadow: 0 12px 40px rgba(30, 144, 255, 0.3);
    width: 100%;
    margin: 0 auto 32px auto;
    border: 6px solid #1e90ff;
    box-sizing: border-box;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .content-section:hover {
    box-shadow: 0 16px 48px rgba(30, 144, 255, 0.4);
    transform: translateY(-2px);
  }

  /* 学生管理区域内的 content-section 移除留白，允许内容自然高度以便父级滚动 */
  .student-management-main .content-section {
    margin-bottom: 0;
    padding: 0;
    flex: 0 0 auto;
    min-height: 0;
    height: auto;
    display: flex;
    flex-direction: column;
  }

  .student-management-main .content-section .table-container {
    flex: 0 0 auto;
    overflow-y: visible;
  }

  .student-management-main .section-header {
    padding: 8px 12px;
    margin-bottom: 0;
  }

  /* section-wrapper 内的 content-section 保持正常 margin */
  .section-wrapper .content-section {
    margin-bottom: 32px;
  }

  .content-section.learning-plan-section {
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  /* 表格列表样式 - 参考 PlanView */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
    padding: 24px 32px;
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    border-radius: 20px 20px 0 0;
    border-bottom: 4px solid #0c7cd5;
    margin: -32px -24px 24px -24px;
    position: relative;
  }

  .section-header .header-left {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .section-header h2 {
    margin: 0;
    color: white;
    font-size: 1.8rem;
    font-weight: 900;
    text-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
    letter-spacing: 1px;
  }

  .section-header .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .count-info {
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    font-weight: 600;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .table-container {
    width: 100%;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: #64748b;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top: 4px solid #1e90ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    color: #1e293b;
    font-size: 20px;
    font-weight: 600;
  }

  .empty-state p {
    margin: 0;
    color: #64748b;
    font-size: 16px;
  }

  /* 表格容器 */
  .data-table-container {
    background: white;
    border-radius: 20px;
    border: 5px solid #1e90ff;
    overflow: hidden;
    width: 100%;
    box-shadow: 0 8px 24px rgba(30, 144, 255, 0.2);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table thead {
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  }

  .data-table th {
    padding: 16px;
    text-align: left;
    font-weight: 600;
    font-size: 14px;
    color: white;
    white-space: nowrap;
  }

  .data-table td {
    padding: 16px;
    border-top: 1px solid #e2e8f0;
    font-size: 14px;
    color: #1e293b;
  }

  .table-row {
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .table-row:hover {
    background: #f8fafc;
  }

  /* 表格单元格样式 */
  .exam-name-cell,
  .student-name-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .exam-name-text,
  .student-name-text {
    font-weight: 600;
    color: #1e293b;
    font-size: 14px;
  }

  .exam-level-badge {
    font-weight: 600;
    color: #1e90ff;
    font-size: 14px;
  }

  .type-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    display: inline-block;
  }

  .type-真题 {
    background: #e0f7fa;
    color: #1e90ff;
  }

  .type-模拟 {
    background: #fef3c7;
    color: #d97706;
  }

  .type-专项 {
    background: #d1fae5;
    color: #065f46;
  }

  .question-count {
    font-weight: 500;
    color: #1e293b;
  }

  .date-cell {
    color: #64748b;
    font-size: 13px;
  }

  .username-text {
    color: #64748b;
    font-size: 14px;
  }

  .email-text {
    color: #64748b;
    font-size: 14px;
  }

  .submission-count {
    font-weight: 600;
    color: #1e293b;
  }

  .accuracy-rate {
    font-weight: 600;
    font-size: 14px;
  }

  .accuracy-rate.excellent {
    color: #22c55e;
  }

  .accuracy-rate.good {
    color: #3b82f6;
  }

  .accuracy-rate.pass {
    color: #f59e0b;
  }

  .accuracy-rate.fail {
    color: #ef4444;
  }

  .pass-rate {
    font-weight: 600;
    font-size: 14px;
  }

  .pass-rate.excellent {
    color: #22c55e;
  }

  .pass-rate.good {
    color: #3b82f6;
  }

  .pass-rate.pass {
    color: #f59e0b;
  }

  .pass-rate.fail {
    color: #ef4444;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .btn-action {
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
  }

  .btn-view {
    background: #0ea5e9;
    color: white;
  }

  .btn-view:hover {
    background: #0284c7;
    transform: translateY(-1px);
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    padding: 40px;
    color: #718096;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e2e8f0;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .empty-state {
    text-align: center;
    padding: 40px;
    color: #718096;
  }
  
  .empty-state p {
    font-size: 1.1rem;
    margin: 0;
  }

  @media (max-width: 768px) {
    .sidebar {
      width: 320px;
    }
    
    .main-content {
      margin-right: 320px;
      padding: 20px;
    }
  }

  /* 学生管理样式 */
  .student-management-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .student-management-header h2 {
    margin: 0;
    color: #1e293b;
    font-size: 1.8rem;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    padding: 14px 20px 14px 44px;
    border: 3px solid #e2e8f0;
    border-radius: 16px;
    font-size: 14px;
    width: 300px;
    transition: all 0.3s ease;
    font-weight: 500;
    background: white;
  }

  .search-input:focus {
    outline: none;
    border-color: #1e90ff;
    border-width: 4px;
    box-shadow: 0 0 0 4px rgba(30, 144, 255, 0.15);
  }

  .search-icon {
    position: absolute;
    left: 12px;
    color: #64748b;
    font-size: 16px;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    top: 50%;
    transform: translateY(-50%);
  }

  .btn-primary {
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    color: white;
    border: 5px solid #0c7cd5;
    padding: 14px 24px;
    border-radius: 16px;
    font-weight: 900;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4);
    border-width: 6px;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .btn-secondary {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    color: #64748b;
    border: 3px solid #e2e8f0;
    padding: 14px 24px;
    border-radius: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .btn-secondary:hover {
    background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
    color: #475569;
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
    border-width: 4px;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-delete {
    color: #ef4444;
  }

  .btn-delete:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .students-container {
    margin-top: 24px;
  }

  .students-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 24px;
  }

  .student-card {
    background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
    border: 5px solid #1e90ff;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(30, 144, 255, 0.2);
    transition: all 0.3s ease;
  }

  .student-card:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 16px 40px rgba(30, 144, 255, 0.4);
    border-color: #0c7cd5;
    border-width: 6px;
  }

  .student-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
    border-bottom: 3px solid #1e90ff;
  }

  .student-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .student-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 18px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
  }

  .student-details h3 {
    margin: 0 0 4px 0;
    color: #1e293b;
    font-size: 16px;
    font-weight: 600;
  }

  .student-details p {
    margin: 0;
    color: #64748b;
    font-size: 14px;
  }

  .student-actions {
    display: flex;
    gap: 8px;
  }

  .student-stats {
    display: flex;
    justify-content: space-around;
    padding: 16px 20px;
    background: #f8fafc;
  }

  .student-stats .stat-item {
    text-align: center;
  }

  .student-stats .stat-label {
    display: block;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 4px;
  }

  .student-stats .stat-value {
    display: block;
    font-size: 16px;
    font-weight: 600;
    color: #1e90ff;
  }

  /* 对话框样式 */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .dialog {
    background: white;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    animation: modalSlideIn 0.3s ease;
    box-sizing: border-box;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dialog-large {
    max-width: 800px;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 28px;
    border-bottom: 2px solid #e0f2fe;
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    border-radius: 20px 20px 0 0;
  }

  .dialog-header h3 {
    margin: 0;
    color: white;
    font-size: 1.8rem;
    font-weight: 900;
    text-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
    letter-spacing: 1px;
  }

  .btn-close {
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.3);
    font-size: 24px;
    color: white;
    cursor: pointer;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
    border-width: 3px;
  }

  .dialog-body {
    padding: 24px;
  }

  .user-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .form-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .form-group label {
    margin-bottom: 8px;
    color: #374151;
    font-weight: 600;
    font-size: 14px;
  }

  .form-group input,
  .form-group select {
    padding: 14px 16px;
    border: 3px solid #e2e8f0;
    border-radius: 12px;
    font-size: 14px;
    transition: all 0.3s ease;
    font-weight: 500;
    background: white;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #1e90ff;
    border-width: 4px;
    box-shadow: 0 0 0 4px rgba(30, 144, 255, 0.15);
  }

  .dialog-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }

  /* 绑定学生对话框样式 */
  .available-students h4 {
    margin: 0 0 16px 0;
    color: #1e293b;
    font-size: 16px;
    font-weight: 600;
  }

  .students-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
  }

  .student-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .student-option:hover {
    background: #f8fafc;
    border-color: #1e90ff;
  }

  .student-option.selected {
    background: #eff6ff;
    border-color: #1e90ff;
  }

  .student-option input[type="checkbox"] {
    margin: 0;
    accent-color: #1e90ff;
  }

  .student-option-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .student-avatar-small {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1e90ff 0%, #87ceeb 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
  }

  .student-option-details h5 {
    margin: 0 0 2px 0;
    color: #1e293b;
    font-size: 14px;
    font-weight: 600;
  }

  .student-option-details p {
    margin: 0;
    color: #64748b;
    font-size: 12px;
  }

  .search-results-info {
    margin: 12px 0;
    padding: 8px 12px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 6px;
    font-size: 14px;
    color: #0369a1;
  }

  .search-results-info span {
    font-weight: 500;
  }

  .bind-class-row,
  .batch-class-row {
    margin-bottom: 16px;
  }

  .class-no-input {
    max-width: 280px;
  }

  /* 学生详情对话框样式 */
  .student-detail-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .student-detail-header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
    background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
    border-radius: 20px;
    border: 5px solid #1e90ff;
    box-shadow: 0 4px 16px rgba(30, 144, 255, 0.2);
  }

  .student-avatar-large {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1e90ff 0%, #87ceeb 100%);
    color: white;
    display: flex;
      align-items: center;
      justify-content: center;
    font-weight: 600;
    font-size: 32px;
    box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
  }

  .student-detail-info h2 {
    margin: 0 0 8px 0;
    color: #1e293b;
    font-size: 24px;
    font-weight: 600;
  }

  .student-detail-info p {
    margin: 0 0 4px 0;
    color: #64748b;
    font-size: 16px;
  }

  .student-detail-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px;
    background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
    border: 3px solid #bae6fd;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(30, 144, 255, 0.15);
    transition: all 0.3s ease;
  }

  .stat-card:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 8px 20px rgba(30, 144, 255, 0.25);
    border-color: #1e90ff;
    border-width: 4px;
  }

  .stat-icon {
    font-size: 32px;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1e90ff;
    flex-shrink: 0;
    background: linear-gradient(135deg, rgba(30, 144, 255, 0.15) 0%, rgba(56, 189, 248, 0.1) 100%);
    border-radius: 16px;
    border: 2px solid rgba(30, 144, 255, 0.2);
    box-shadow: 0 2px 8px rgba(30, 144, 255, 0.15);
  }

  .stat-content {
    flex: 1;
  }

  .stat-number {
    font-size: 28px;
    font-weight: 900;
    color: #1e90ff;
    margin-bottom: 4px;
    text-shadow: 0 2px 4px rgba(30, 144, 255, 0.2);
  }

  .stat-label {
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
  }

  .student-detail-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }

  .btn-warning {
    background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
    color: white;
    border: 5px solid #d97706;
    padding: 14px 24px;
    border-radius: 16px;
    font-weight: 900;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
  }

  .btn-warning:hover {
    background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
    border-width: 6px;
  }

  .btn-danger {
    background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
    color: white;
    border: 5px solid #dc2626;
    padding: 14px 24px;
    border-radius: 16px;
    font-weight: 900;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
  }

  .btn-danger:hover {
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    border-width: 6px;
  }

  .icon-arrow {
    color: #64748b;
    font-size: 18px;
    font-weight: bold;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .students-grid {
      grid-template-columns: 1fr;
    }

    .student-management-header {
    flex-direction: column;
      align-items: flex-start;
    }

    .header-actions {
      flex-direction: column;
      align-items: stretch;
    gap: 12px;
      width: 100%;
    }

    .search-input {
      width: 100%;
    }

    .form-row {
      flex-direction: column;
      gap: 0;
    }

    .dialog {
      width: 95%;
      margin: 20px;
    }

    .dialog-actions {
      flex-direction: column;
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
    }

    .student-detail-header {
      flex-direction: column;
      text-align: center;
      gap: 16px;
    }

    .student-detail-stats {
      grid-template-columns: 1fr;
    }

    .student-detail-actions {
      flex-direction: column;
    }

  .btn-danger {
    width: 100%;
  }
  }

  /* 角色信息样式 */
  .role-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .role-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    display: inline-block;
  }

  .role-badge.role-user {
    background: #bee3f8;
    color: #2b6cb0;
  }

  .role-description {
    font-size: 12px;
    color: #64748b;
    font-style: italic;
  }

  /* 自动绑定选项样式 */
  .bind-option {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .bind-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 4px 0;
  }

  .bind-checkbox input[type="checkbox"] {
    margin: 0;
    accent-color: #1e90ff;
    width: 16px;
    height: 16px;
  }

  .bind-label {
    font-size: 14px;
    color: #1e293b;
    font-weight: 500;
  }

  .bind-description {
    font-size: 12px;
    color: #64748b;
    font-style: italic;
    margin-left: 24px;
  }

  /* 学生提交相关样式 */
  .student-submissions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .student-submissions-header h2 {
    margin: 0;
    color: #1e293b;
    font-size: 1.8rem;
    font-weight: 600;
  }

  .level-filter {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .level-filter label {
    color: #64748b;
    font-weight: 600;
    font-size: 14px;
  }

  .level-select {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .level-select:focus {
    outline: none;
    border-color: #1e90ff;
    box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
  }

  .exams-container {
    margin-top: 24px;
  }

  .exams-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 24px;
  }

  .exam-card {
    background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
    border: 5px solid #1e90ff;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(30, 144, 255, 0.2);
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .exam-card:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 16px 40px rgba(30, 144, 255, 0.4);
    border-color: #0c7cd5;
    border-width: 6px;
  }

  .exam-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
    border-bottom: 3px solid #1e90ff;
  }

  .exam-info h3 {
    margin: 0 0 4px 0;
    color: #1e293b;
    font-size: 16px;
    font-weight: 600;
  }

  .exam-info p {
    margin: 0;
    color: #64748b;
    font-size: 14px;
  }

  .exam-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .type-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .type-真题 { background: #e0f7fa; color: #1e90ff; }
  .type-模拟 { background: #fef3c7; color: #d97706; }
  .type-专项 { background: #d1fae5; color: #065f46; }

  .exam-stats {
    display: flex;
    justify-content: space-around;
    padding: 16px 20px;
    background: #f8fafc;
  }

  .exam-stats .stat-item {
    text-align: center;
  }

  .exam-stats .stat-label {
    display: block;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 4px;
  }

  .exam-stats .stat-value {
    display: block;
    font-size: 16px;
    font-weight: 600;
    color: #1e90ff;
  }

  /* 考试学生详情对话框样式 */
  .exam-students-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .exam-summary {
    background: linear-gradient(135deg, rgba(30, 144, 255, 0.05) 0%, rgba(135, 206, 235, 0.02) 100%);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
  }

  .summary-card {
    display: flex;
    justify-content: space-around;
    gap: 20px;
  }

  .summary-item {
    text-align: center;
  }

  .summary-label {
    display: block;
    font-size: 14px;
    color: #64748b;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .summary-value {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: #1e90ff;
  }

  .students-submission-list h4 {
    margin: 0 0 16px 0;
    color: #1e293b;
    font-size: 18px;
    font-weight: 600;
  }

  .students-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 500px;
    overflow-y: auto;
  }

  .student-submission-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #ffffff;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .student-submission-item.submitted {
    border-color: #10b981;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%);
  }

  .student-submission-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .student-submission-details h5 {
    margin: 0 0 4px 0;
    color: #1e293b;
    font-size: 16px;
    font-weight: 600;
  }

  .student-submission-details p {
    margin: 0 0 8px 0;
    color: #64748b;
    font-size: 14px;
  }

  .submission-status {
    margin-top: 8px;
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-badge.submitted {
    background: #d1fae5;
    color: #065f46;
  }

  .status-badge.not-submitted {
    background: #fee2e2;
    color: #991b1b;
  }

  .submission-details {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }

  .submission-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: right;
  }

  .info-item {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .info-label {
    font-size: 12px;
    color: #64748b;
  }

  .info-value {
    font-size: 14px;
    font-weight: 600;
  }

  .info-value.score {
    color: #1e90ff;
  }

  /* 学生提交详情对话框样式 */
  .submission-detail-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .exam-info-section,
  .student-info-section,
  .statistics-section,
  .submissions-section {
    background: #f8fafc;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }

  .exam-info-section h4,
  .student-info-section h4,
  .statistics-section h4,
  .submissions-section h4 {
    margin: 0 0 16px 0;
    color: #1e293b;
    font-size: 18px;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px;
  }

  .info-card {
    background: #ffffff;
    padding: 16px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-label {
    font-weight: 600;
    color: #64748b;
    font-size: 14px;
  }

  .info-value {
    font-weight: 500;
    color: #1e293b;
    font-size: 14px;
  }

  .statistics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .submissions-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .submission-item {
    background: #ffffff;
    padding: 16px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;
  }

  .submission-item:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .submission-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .submission-attempt {
    display: flex;
    align-items: center;
  }

  .attempt-label {
    font-weight: 600;
    color: #1e293b;
    font-size: 16px;
  }

  .submission-score {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .score-value {
    font-size: 24px;
    font-weight: 700;
    color: #1e90ff;
  }

  .score-label {
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
  }

  .submission-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .detail-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
  }

  .detail-value {
    font-size: 14px;
    color: #1e293b;
    font-weight: 500;
  }

  /* 错题相关样式 */
  .wrong-questions-section {
    background: #f8fafc;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }

  .wrong-questions-section h4 {
    margin: 0 0 16px 0;
    color: #1e293b;
    font-size: 18px;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px;
  }

  .wrong-questions-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 500px;
    overflow-y: auto;
  }

  .wrong-question-item {
    background: #ffffff;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
  }

  .wrong-question-item:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }

  .question-number {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .question-label {
    font-weight: 600;
    color: #1e293b;
    font-size: 16px;
  }

  .question-id {
    font-size: 12px;
    color: #64748b;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .question-meta {
    display: flex;
    gap: 8px;
  }

  .difficulty-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .difficulty-badge.easy {
    background: #d1fae5;
    color: #065f46;
  }

  .difficulty-badge.medium {
    background: #fef3c7;
    color: #92400e;
  }

  .difficulty-badge.hard {
    background: #fee2e2;
    color: #991b1b;
  }

  .level-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    background: #e0e7ff;
    color: #3730a3;
  }

  .question-content {
    margin-bottom: 16px;
  }

  .question-text {
    font-size: 16px;
    line-height: 1.6;
    color: #1e293b;
    font-weight: 500;
  }

  .answer-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
    padding: 12px;
    background: #fef2f2;
    border-radius: 8px;
    border: 1px solid #fecaca;
  }

  .answer-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .answer-label {
    font-weight: 600;
    color: #374151;
    font-size: 14px;
    min-width: 80px;
  }

  .student-answer {
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 14px;
  }

  .student-answer.wrong {
    background: #fee2e2;
    color: #dc2626;
  }

  .correctness {
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .correctness.wrong {
    color: #dc2626;
  }

  .correctness :deep(.lucide-icon) {
    flex-shrink: 0;
    color: inherit;
  }

  .explanation-section {
    padding: 16px;
    background: #f0f9ff;
    border-radius: 8px;
    border: 1px solid #bae6fd;
  }

  .explanation-label {
    font-weight: 600;
    color: #0369a1;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .explanation-text {
    font-size: 14px;
    line-height: 1.6;
    color: #0c4a6e;
  }

  /* 批量创建学生样式 */
  .batch-info {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }

  .batch-info p {
    margin: 0;
    color: #0369a1;
    font-size: 14px;
  }

  .batch-students-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 16px;
  }

  .batch-student-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .batch-input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.3s ease;
  }

  .batch-input:focus {
    outline: none;
    border-color: #1e90ff;
    box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
  }

  .btn-remove {
    background: #fee2e2;
    color: #dc2626;
    border: none;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-remove:hover {
    background: #fecaca;
  }

  .btn-add-student {
    background: #f0f9ff;
    color: #0369a1;
    border: 1px dashed #bae6fd;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    margin-bottom: 24px;
  }

  .btn-add-student:hover {
    background: #e0f2fe;
    border-color: #7dd3fc;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .exams-grid {
      grid-template-columns: 1fr;
    }

    .student-submissions-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .level-filter {
      width: 100%;
      justify-content: space-between;
    }

    .level-select {
      flex: 1;
      max-width: 200px;
    }

    .summary-card {
      flex-direction: column;
      gap: 16px;
    }

    .student-submission-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }

    .submission-details {
      align-items: flex-start;
      width: 100%;
    }

    .submission-info {
      text-align: left;
    }

    .statistics-grid {
      grid-template-columns: 1fr;
    }

    .submission-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .submission-score {
      align-self: flex-end;
    }

    .info-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .detail-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .question-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .question-meta {
      align-self: flex-end;
    }

    .answer-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .answer-label {
      min-width: auto;
    }
  }
  
  </style>