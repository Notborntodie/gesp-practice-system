<template>
  <BaseTeacherSection title="计划完成">
    <template #filters>
      <div class="progress-filters">
        <div class="level-filter">
          <label>聚合方式：</label>
          <select v-model="aggregationMode" @change="handleAggregationModeChange" class="level-select">
            <option value="plan">按计划</option>
            <option value="student">按学生</option>
          </select>
        </div>
        <div class="level-filter">
          <label>级别筛选：</label>
          <select v-model="selectedLevel" @change="handleFilterChange" class="level-select">
          <option value="">全部级别</option>
          <option value="1">GESP 1级</option>
          <option value="2">GESP 2级</option>
          <option value="3">GESP 3级</option>
          <option value="4">GESP 4级</option>
          <option value="5">GESP 5级</option>
          <option value="6">GESP 6级</option>
          </select>
        </div>
      </div>
    </template>

    <template #content>
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- 按学生聚合 -->
      <div v-else-if="aggregationMode === 'student'" class="student-aggregate-container">
        <div v-if="selectedStudentPlanDetail || studentPlanDetailLoading">
          <div class="plan-info-card">
            <div class="plan-header">
              <h3>
                {{ selectedStudentPlan?.student?.real_name || selectedStudentPlan?.student?.username }}
                -
                {{ selectedStudentPlan?.plan?.name }}
              </h3>
              <button @click="backToStudentAggregate" class="btn-back">← 返回学生列表</button>
            </div>
            <div class="plan-meta" v-if="selectedStudentPlan?.plan">
              <span class="meta-item">级别: GESP {{ selectedStudentPlan.plan.level }}级</span>
              <span class="meta-item">开始时间: {{ formatDate(selectedStudentPlan.plan.start_time) }}</span>
              <span class="meta-item">结束时间: {{ formatDate(selectedStudentPlan.plan.end_time) }}</span>
            </div>
          </div>

          <div v-if="studentPlanDetailLoading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载学生计划明细...</span>
          </div>

          <div v-else-if="selectedStudentPlanDetail" class="student-plan-detail">
            <div class="progress-overview">
              <h4>计划完成概览</h4>
              <div class="overview-cards">
                <div class="overview-card">
                  <div class="overview-label">任务完成</div>
                  <div class="overview-value">
                    {{ selectedStudentPlanDetail.plan_progress?.completed_tasks || 0 }}/{{ selectedStudentPlanDetail.plan_progress?.total_tasks || 0 }}
                  </div>
                </div>
                <div class="overview-card">
                  <div class="overview-label">完成率</div>
                  <div class="overview-value">{{ selectedStudentPlanDetail.plan_progress?.progress_rate || 0 }}%</div>
                </div>
                <div class="overview-card">
                  <div class="overview-label">状态</div>
                  <div class="overview-value">
                    {{ isCompleted(selectedStudentPlanDetail.plan_progress?.is_completed) ? '已完成' : '进行中' }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="selectedStudentPlanDetail.tasks?.length" class="student-task-detail-list">
              <div v-for="task in selectedStudentPlanDetail.tasks" :key="task.id" class="student-task-card">
                <div class="task-header">
                  <div>
                    <div class="task-name">任务 {{ task.task_order ?? '-' }}：{{ task.name }}</div>
                    <div v-if="task.description" class="task-description">{{ task.description }}</div>
                  </div>
                  <span class="task-status-badge" :class="isCompleted(task.task_progress?.is_completed) ? 'completed' : 'in-progress'">
                    {{ isCompleted(task.task_progress?.is_completed) ? '已完成' : '进行中' }}
                  </span>
                </div>

                <div class="task-progress-summary">
                  <span>客观题 {{ task.exam_progress?.completed || 0 }}/{{ task.exam_progress?.total || 0 }}</span>
                  <span>编程题 {{ task.oj_progress?.completed || 0 }}/{{ task.oj_progress?.total || 0 }}</span>
                </div>

                <div v-if="task.exam_progress?.exams?.length" class="exercise-subsection">
                  <h5>客观题分数</h5>
                  <div class="exercise-list-compact">
                    <div v-for="exam in task.exam_progress.exams" :key="`student-exam-${task.id}-${exam.id}`" class="exercise-compact-row">
                      <div>
                        <div class="exercise-compact-name">{{ exam.name }}</div>
                        <div class="exercise-compact-meta">尝试 {{ exam.attempt_count || 0 }} 次</div>
                      </div>
                      <div class="exercise-compact-score">
                        <span>{{ formatScore(exam.best_score) }}分</span>
                        <span class="score-status-badge" :class="{ completed: isCompleted(exam.is_completed) }">
                          {{ isCompleted(exam.is_completed) ? '完成' : '未完成' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="task.oj_progress?.problems?.length" class="exercise-subsection">
                  <h5>编程题完成情况</h5>
                  <div class="exercise-list-compact">
                    <div v-for="problem in task.oj_progress.problems" :key="`student-oj-${task.id}-${problem.id}`" class="exercise-compact-row">
                      <div>
                        <div class="exercise-compact-name">{{ problem.title }}</div>
                        <div class="exercise-compact-meta">尝试 {{ problem.attempt_count || 0 }} 次</div>
                      </div>
                      <div class="exercise-compact-score">
                        <span v-if="!isCompleted(problem.is_completed)">{{ formatScore(problem.score ?? problem.best_pass_rate) }}分</span>
                        <span class="score-status-badge" :class="{ completed: isCompleted(problem.is_completed) }">
                          {{ isCompleted(problem.is_completed) ? '完成' : '未完成' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="!task.exam_progress?.exams?.length && !task.oj_progress?.problems?.length" class="empty-task-exercises">
                  该任务暂无题目
                </div>
              </div>
            </div>

            <div v-else class="empty-state">
              <p>该学生在此计划下暂无任务明细</p>
            </div>
          </div>
        </div>

        <div v-else-if="studentPlanLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>加载学生计划完成概览...</span>
        </div>

        <div v-else-if="studentPlanRows.length > 0" class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>班级</th>
                <th>学生姓名</th>
                <th>用户名</th>
                <th>所在计划</th>
                <th>计划完成</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in studentPlanRows" :key="student.student_id" class="table-row">
                <td>{{ student.class_no || '—' }}</td>
                <td class="student-name-cell">
                  <div class="student-name-text">{{ student.real_name || student.username }}</div>
                </td>
                <td><span class="username-text">{{ student.username }}</span></td>
                <td>
                  <div v-if="student.plans?.length" class="student-plan-list">
                    <button
                      v-for="plan in student.plans"
                      :key="plan.id"
                      class="student-plan-chip"
                      @click="viewStudentPlanDetail(student, plan)"
                    >
                      <span class="student-plan-chip-name">{{ plan.name }}</span>
                      <span class="student-plan-chip-progress">
                        {{ plan.plan_progress?.completed_tasks || 0 }}/{{ plan.plan_progress?.total_tasks || 0 }}
                      </span>
                    </button>
                  </div>
                  <span v-else class="empty-plan-text">暂无计划</span>
                </td>
                <td>
                  <span class="status-badge" :class="student.completed_plan_count === student.plan_count && student.plan_count > 0 ? 'completed' : 'in-progress'">
                    {{ student.completed_plan_count || 0 }}/{{ student.plan_count || 0 }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-state">
          <p>当前筛选条件下暂无学生计划进度</p>
        </div>
      </div>

      <!-- 任务完成页面 -->
      <div v-else-if="selectedPlan && selectedTask">
        <!-- 计划信息 -->
        <div class="plan-info-card">
          <div class="plan-header">
            <h3>{{ selectedPlan.name }} - {{ selectedTask.name }}</h3>
            <button @click="selectedTask = null" class="btn-back">← 返回任务列表</button>
          </div>
          <div class="plan-meta">
            <span class="meta-item">级别: GESP {{ selectedPlan.level }}级</span>
            <span class="meta-item">任务开始时间: {{ formatDate(selectedTask.start_time) }}</span>
            <span class="meta-item">任务结束时间: {{ formatDate(selectedTask.end_time) }}</span>
          </div>
        </div>

        <!-- 学生完成情况列表 -->
        <div v-if="studentsLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>加载学生完成情况...</span>
        </div>

        <div v-else-if="taskStudents.length > 0" class="students-progress-container">
          <!-- 导出按钮 -->
          <div class="export-actions">
            <button 
              @click="exportTaskProgress(selectedTask)" 
              class="btn-action btn-export"
              title="导出学生完成情况"
            >
              <Icon name="download" :size="16" />
              导出学生完成情况
            </button>
          </div>
          
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>学生姓名</th>
                  <th>用户名</th>
                  <th>任务完成状态</th>
                  <th v-if="selectedTask && isExamMode(selectedTask)">总分</th>
                  <th>客观题进度</th>
                  <th>OJ题进度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="student in sortedTaskStudents" :key="student.student_id" class="table-row">
                  <td class="student-name-cell">
                    <div class="student-name-text">{{ student.real_name || student.username }}</div>
                  </td>
                  <td>
                    <span class="username-text">{{ student.username }}</span>
                  </td>
                  <td>
                    <span 
                      class="status-badge" 
                      :class="isCompleted(student.task_progress?.is_completed) ? 'completed' : 'in-progress'"
                    >
                      {{ isCompleted(student.task_progress?.is_completed) ? '已完成' : '进行中' }}
                    </span>
                  </td>
                  <td v-if="selectedTask && isExamMode(selectedTask)">
                    <span class="student-score-badge">
                      {{ getStudentExamScore(student) >= 0 ? getStudentExamScore(student) : '-' }}
                    </span>
                  </td>
                  <td>
                    <div class="progress-info">
                      <span class="progress-text">
                        {{ formatProgress(student.exam_progress) }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class="progress-info">
                      <span class="progress-text">
                        {{ formatProgress(student.oj_progress) }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button 
                      @click="viewTaskStudentDetail(student)" 
                      class="btn-action btn-view"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
                      </div>
                    </div>

        <div v-else class="empty-state">
          <p>该任务下暂无学生</p>
        </div>
      </div>

      <!-- 任务列表页面 -->
      <div v-else-if="selectedPlan">
        <!-- 计划信息 -->
        <div class="plan-info-card">
          <div class="plan-header">
            <h3>{{ selectedPlan.name }}</h3>
            <button @click="selectedPlan = null" class="btn-back">← 返回计划列表</button>
          </div>
          <div class="plan-meta">
            <span class="meta-item">级别: GESP {{ selectedPlan.level }}级</span>
            <span class="meta-item">开始时间: {{ formatDate(selectedPlan.start_time) }}</span>
            <span class="meta-item">结束时间: {{ formatDate(selectedPlan.end_time) }}</span>
          </div>
        </div>

        <!-- 任务列表 -->
        <div v-if="tasksLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>加载任务列表...</span>
        </div>

        <div v-else-if="tasks.length > 0" class="tasks-progress-container">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>任务名称</th>
                  <th>任务描述</th>
                  <th>开始时间</th>
                  <th>结束时间</th>
                  <th>客观题数量</th>
                  <th>OJ题数量</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in tasks" :key="task.id" class="table-row">
                  <td class="task-name-cell">
                    <div class="task-name-text">{{ task.name }}</div>
                    <span v-if="isExamMode(task)" class="exam-mode-tag">
                      <Icon name="clipboard-check" :size="14" />
                      考试模式
                    </span>
                  </td>
                  <td>
                    <span class="task-description">{{ task.description || '-' }}</span>
                  </td>
                  <td class="date-cell">{{ formatDate(task.start_time) }}</td>
                  <td class="date-cell">{{ formatDate(task.end_time) }}</td>
                  <td>
                    <span class="count-badge">{{ task.exam_count || 0 }}</span>
                  </td>
                  <td>
                    <span class="count-badge">{{ task.oj_count || 0 }}</span>
                  </td>
                  <td>
                    <button 
                      @click="viewTaskProgress(task)" 
                      class="btn-action btn-view"
                    >
                      查看学生完成情况
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else class="empty-state">
          <p>该计划下暂无任务</p>
        </div>
      </div>

      <!-- 计划列表 -->
      <div v-else class="plans-container">
        <div v-if="plans.length > 0" class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>计划名称</th>
                <th>级别</th>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="plan in plans" :key="plan.id" class="table-row">
                <td>{{ plan.id }}</td>
                <td class="plan-name-cell">
                  <div class="plan-name-text">{{ plan.name }}</div>
                </td>
                <td>
                  <span class="level-badge">GESP {{ plan.level }}级</span>
                </td>
                <td class="date-cell">{{ formatDate(plan.start_time) }}</td>
                <td class="date-cell">{{ formatDate(plan.end_time) }}</td>
                <td>
                  <span class="status-badge" :class="getStatusClass(plan)">
                    {{ getStatusText(plan) }}
                  </span>
                </td>
                <td>
                  <button 
                    @click="viewPlanProgress(plan)" 
                    class="btn-action btn-view"
                  >
                    查看完成情况
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-state">
          <p>暂无学习计划</p>
        </div>
      </div>
    </template>
  </BaseTeacherSection>

  <!-- 任务学生详细完成情况对话框 -->
  <div v-if="showTaskStudentDetailDialog && selectedTaskStudent && selectedTask && selectedPlan" class="dialog-overlay" @click="closeTaskStudentDetailDialog">
    <div class="dialog dialog-xlarge" @click.stop>
      <div class="dialog-header">
        <h3>{{ selectedTaskStudent.real_name || selectedTaskStudent.username }} - {{ selectedTask.name }} 完成情况</h3>
        <button @click="closeTaskStudentDetailDialog" class="btn-close">&times;</button>
      </div>
      <div class="dialog-body">
        <div v-if="taskStudentDetailLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>
        <div v-else-if="taskStudentDetail" class="task-detail-content">
          <!-- 学生和任务信息 -->
          <div class="task-info-section">
            <h4>学生和任务信息</h4>
            <div class="info-card">
              <div class="info-row">
                <span class="info-label">学生姓名:</span>
                <span class="info-value">{{ taskStudentDetail.student.real_name || taskStudentDetail.student.username }}</span>
                </div>
              <div class="info-row">
                <span class="info-label">用户名:</span>
                <span class="info-value">{{ taskStudentDetail.student.username }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">任务名称:</span>
                <span class="info-value">{{ taskStudentDetail.task.name }}</span>
                </div>
              <div class="info-row" v-if="taskStudentDetail.task.description">
                <span class="info-label">任务描述:</span>
                <span class="info-value">{{ taskStudentDetail.task.description }}</span>
              </div>
            </div>
          </div>

          <!-- 考试模式总分面板 -->
          <div v-if="isExamMode(taskStudentDetail.task) && getExamModeScore(taskStudentDetail)" class="exam-score-panel">
            <div class="score-panel-header">
              <Icon name="trophy" :size="32" />
              <h3>考试成绩</h3>
            </div>
            <div class="score-panel-body">
              <div class="total-score-display">
                <span class="total-score-value">{{ getExamModeScore(taskStudentDetail)?.total }}</span>
                <span class="total-score-label">总分</span>
              </div>
              <div class="score-breakdown">
                <div class="score-item">
                  <div class="score-item-header">
                    <Icon name="file-text" :size="18" />
                    <span>客观题 (50%)</span>
                  </div>
                  <div class="score-item-value" :class="{ 'no-submission': !getExamModeScore(taskStudentDetail)?.hasExamSubmission }">
                    {{ getExamModeScore(taskStudentDetail)?.hasExamSubmission ? getExamModeScore(taskStudentDetail)?.examScore : '未提交' }}
                  </div>
                </div>
                <div class="score-item">
                  <div class="score-item-header">
                    <Icon name="code" :size="18" />
                    <span>编程题1 (25%)</span>
                  </div>
                  <div class="score-item-value" :class="{ 'no-submission': !(getExamModeScore(taskStudentDetail)?.hasOJ1Submission ?? false), 'score-perfect': (getExamModeScore(taskStudentDetail)?.oj1Score ?? 0) === 100, 'score-partial': (getExamModeScore(taskStudentDetail)?.oj1Score ?? 0) > 0 && (getExamModeScore(taskStudentDetail)?.oj1Score ?? 0) < 100 }">
                    {{ (getExamModeScore(taskStudentDetail)?.hasOJ1Submission ?? false) ? ((getExamModeScore(taskStudentDetail)?.oj1Score ?? 0) + '分') : '未提交' }}
                  </div>
                </div>
                <div class="score-item">
                  <div class="score-item-header">
                    <Icon name="code" :size="18" />
                    <span>编程题2 (25%)</span>
                  </div>
                  <div class="score-item-value" :class="{ 'no-submission': !(getExamModeScore(taskStudentDetail)?.hasOJ2Submission ?? false), 'score-perfect': (getExamModeScore(taskStudentDetail)?.oj2Score ?? 0) === 100, 'score-partial': (getExamModeScore(taskStudentDetail)?.oj2Score ?? 0) > 0 && (getExamModeScore(taskStudentDetail)?.oj2Score ?? 0) < 100 }">
                    {{ (getExamModeScore(taskStudentDetail)?.hasOJ2Submission ?? false) ? ((getExamModeScore(taskStudentDetail)?.oj2Score ?? 0) + '分') : '未提交' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 客观题列表 -->
          <div class="exams-section" v-if="taskStudentDetail.exam_progress && taskStudentDetail.exam_progress.length > 0">
            <h4>客观题列表 ({{ taskStudentDetail.exam_progress.length }})</h4>
            <div class="exams-list">
              <div 
                v-for="exam in sortedExamProgress" 
                :key="exam.id" 
                class="exam-item"
                @click="viewExamSubmissions(exam)"
              >
                <div class="exam-header">
                  <div class="exam-name">{{ exam.name }}</div>
                  <div class="exam-header-right">
                    <span v-if="isExamMode(taskStudentDetail.task) && exam.best_score !== null && exam.best_score !== undefined" class="exam-score-badge">
                      {{ exam.best_score }}分
                    </span>
                  <span 
                      class="exam-status-badge" 
                      :class="isCompleted(exam.is_completed) ? 'completed' : 'in-progress'"
                  >
                      {{ isCompleted(exam.is_completed) ? '已完成' : '未完成' }}
                  </span>
                </div>
                </div>
                <div class="exam-meta">
                  <span class="exam-level-badge">{{ exam.level }}级</span>
                  <span class="exam-type-badge" :class="`type-${exam.type || '真题'}`">
                    {{ exam.type || '真题' }}
                      </span>
                  <span v-if="!isExamMode(taskStudentDetail.task) && exam.best_score !== null" class="exam-score">
                    最高分: {{ exam.best_score }}分
                  </span>
                  <span v-if="exam.attempt_count > 0" class="exam-attempts">
                    尝试次数: {{ exam.attempt_count }}
                  </span>
                </div>
                <div class="exam-action">
                  <button @click.stop="viewExamSubmissions(exam)" class="btn-action btn-view">
                    查看提交
                  </button>
                </div>
                      </div>
                    </div>
                  </div>

          <!-- OJ题列表 -->
          <div class="oj-problems-section" v-if="taskStudentDetail.oj_progress && taskStudentDetail.oj_progress.length > 0">
            <h4>OJ题列表 ({{ taskStudentDetail.oj_progress.length }})</h4>
            <div class="oj-problems-list">
              <div 
                v-for="problem in sortedOJProgress" 
                :key="problem.id" 
                class="oj-problem-item"
                @click="viewOJSubmissions(problem)"
              >
                <div class="oj-problem-header">
                  <div class="oj-problem-name">{{ problem.title }}</div>
                  <div class="oj-problem-header-right">
                    <span v-if="isExamMode(taskStudentDetail.task)" class="oj-problem-score-badge">
                      {{ getOJScore(problem) }}分
                    </span>
                    <span 
                      class="oj-problem-status-badge" 
                      :class="isCompleted(problem.is_completed) ? 'completed' : 'in-progress'"
                    >
                      {{ isCompleted(problem.is_completed) ? '已完成' : '未完成' }}
                    </span>
                      </div>
                    </div>
                <div class="oj-problem-meta">
                  <span class="oj-problem-level-badge">{{ problem.level }}级</span>
                  <span v-if="!isExamMode(taskStudentDetail.task) && problem.best_verdict" class="oj-problem-verdict" :class="getVerdictClass(problem.best_verdict)">
                    {{ getVerdictText(problem.best_verdict) }}
                  </span>
                  <span v-if="problem.attempt_count > 0" class="oj-problem-attempts">
                    尝试次数: {{ problem.attempt_count }}
                  </span>
                  </div>
                <div class="oj-problem-action">
                  <button @click.stop="viewOJSubmissions(problem)" class="btn-action btn-view">
                    查看提交
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="(!taskStudentDetail.exam_progress || taskStudentDetail.exam_progress.length === 0) && (!taskStudentDetail.oj_progress || taskStudentDetail.oj_progress.length === 0)" class="empty-state">
            <p>该任务暂无关联的客观题和OJ题</p>
          </div>

          <div class="dialog-actions">
            <button @click="closeTaskStudentDetailDialog" class="btn-secondary">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import BaseTeacherSection from './BaseTeacherSection.vue'
import Icon from '@/components/Icon.vue'

import { BASE_URL } from '@/config/api'

const router = useRouter()
const route = useRoute()

// 用户信息
const userInfo = ref<any>(null)

// 计划相关
const plans = ref<any[]>([])
const selectedPlan = ref<any>(null)
const selectedLevel = ref('')
const loading = ref(false)
const aggregationMode = ref<'plan' | 'student'>('plan')

// 按学生聚合
const studentPlanRows = ref<any[]>([])
const studentPlanLoading = ref(false)
const selectedStudentPlan = ref<any>(null)
const selectedStudentPlanDetail = ref<any>(null)
const studentPlanDetailLoading = ref(false)

// 任务列表
const tasks = ref<any[]>([])
const tasksLoading = ref(false)
const selectedTask = ref<any>(null)

// 任务下的学生完成情况
const taskStudents = ref<any[]>([])
const studentsLoading = ref(false)

// 任务学生详细完成情况
const showTaskStudentDetailDialog = ref(false)
const selectedTaskStudent = ref<any>(null)
const taskStudentDetail = ref<any>(null)
const taskStudentDetailLoading = ref(false)

// 获取用户信息
const getUserInfo = () => {
  const userInfoStr = localStorage.getItem('userInfo')
  if (userInfoStr) {
    userInfo.value = JSON.parse(userInfoStr)
  }
}

// 获取计划列表
const fetchPlans = async () => {
  if (!userInfo.value) return
  
  loading.value = true
  try {
    const params: any = {}
    if (selectedLevel.value) {
      params.level = selectedLevel.value
    }
    // 只获取激活的计划
    params.is_active = '1'
    
    const response = await axios.get(`${BASE_URL}/learning-plans/all`, { params })
    
    if (response.data.success) {
      plans.value = response.data.data || []
    }
  } catch (error: any) {
    console.error('获取学习计划列表失败:', error)
    alert('获取学习计划列表失败: ' + (error.response?.data?.message || error.message))
  } finally {
    loading.value = false
  }
}

const fetchStudentPlanProgress = async () => {
  if (!userInfo.value) return

  studentPlanLoading.value = true
  try {
    const params: any = { is_active: '1' }
    if (selectedLevel.value) {
      params.level = selectedLevel.value
    }

    const response = await axios.get(
      `${BASE_URL}/learning-plans/teacher/${userInfo.value.id}/student-plans-progress`,
      { params }
    )

    if (response.data.success) {
      studentPlanRows.value = response.data.data?.students || []
    } else {
      alert('获取学生计划完成概览失败: ' + (response.data.message || '未知错误'))
      studentPlanRows.value = []
    }
  } catch (error: any) {
    console.error('获取学生计划完成概览失败:', error)
    alert('获取学生计划完成概览失败: ' + (error.response?.data?.message || error.message))
    studentPlanRows.value = []
  } finally {
    studentPlanLoading.value = false
  }
}

const handleFilterChange = () => {
  selectedPlan.value = null
  selectedTask.value = null
  selectedStudentPlan.value = null
  selectedStudentPlanDetail.value = null
  if (aggregationMode.value === 'student') {
    fetchStudentPlanProgress()
  } else {
    fetchPlans()
  }
}

const handleAggregationModeChange = () => {
  selectedPlan.value = null
  selectedTask.value = null
  selectedStudentPlan.value = null
  selectedStudentPlanDetail.value = null
  if (aggregationMode.value === 'student') {
    fetchStudentPlanProgress()
  } else {
    fetchPlans()
  }
}

const viewStudentPlanDetail = async (student: any, plan: any) => {
  if (!userInfo.value) return

  selectedStudentPlan.value = { student, plan }
  selectedStudentPlanDetail.value = null
  studentPlanDetailLoading.value = true

  try {
    const response = await axios.get(
      `${BASE_URL}/learning-plans/${plan.id}/students/${student.student_id}/progress`,
      { params: { teacher_id: userInfo.value.id } }
    )

    if (response.data.success) {
      selectedStudentPlanDetail.value = response.data.data
    } else {
      alert('获取学生计划明细失败: ' + (response.data.message || '未知错误'))
    }
  } catch (error: any) {
    console.error('获取学生计划明细失败:', error)
    alert('获取学生计划明细失败: ' + (error.response?.data?.message || error.message))
  } finally {
    studentPlanDetailLoading.value = false
  }
}

const backToStudentAggregate = () => {
  selectedStudentPlan.value = null
  selectedStudentPlanDetail.value = null
  studentPlanDetailLoading.value = false
}

// 查看计划完成情况 - 进入任务列表
const viewPlanProgress = async (plan: any) => {
  if (!userInfo.value) return
  
  selectedPlan.value = plan
  selectedTask.value = null
  tasksLoading.value = true
  
  try {
    // 方法1: 尝试使用任务列表接口，传递 teacher_id 作为 user_id
    // 虽然接口需要 user_id，但我们可以尝试传递 teacher_id
  try {
    const response = await axios.get(
        `${BASE_URL}/learning-plans/${plan.id}/tasks`,
        { params: { user_id: userInfo.value.id } }
      )
      
      if (response.data.success) {
        tasks.value = response.data.data?.tasks || []
        // 为每个任务添加统计信息（接口已经返回了 exam_count 和 oj_count）
        tasks.value = tasks.value.map((task: any) => ({
          ...task,
          exam_count: task.exam_count || 0,
          oj_count: task.oj_count || 0
        }))
        return
      }
    } catch (err: any) {
      console.log('任务列表接口失败，尝试备用方法:', err)
      // 如果接口返回403（未加入计划），使用备用方法
      if (err.response?.status === 403 || err.response?.status === 404) {
        // 使用备用方法：从 students-progress 接口获取任务信息
        const studentsResponse = await axios.get(
      `${BASE_URL}/learning-plans/${plan.id}/students-progress`,
          { params: { teacher_id: userInfo.value.id } }
        )
        
        if (studentsResponse.data.success) {
          // 从第一个学生的进度中提取任务信息
          const students = studentsResponse.data.data?.students || []
          if (students.length > 0 && students[0].plan_progress) {
            // 获取该学生的详细进度，从中提取任务列表
            const studentId = students[0].student_id
            const progressResponse = await axios.get(
              `${BASE_URL}/learning-plans/${plan.id}/students/${studentId}/progress`,
              { params: { teacher_id: userInfo.value.id } }
            )
            
            if (progressResponse.data.success) {
              const tasksList = progressResponse.data.data?.tasks || []
              tasks.value = tasksList.map((task: any) => ({
                id: task.id,
                name: task.name,
                description: task.description || '',
                start_time: task.start_time,
                end_time: task.end_time,
                task_order: task.task_order,
                exam_count: task.exam_progress?.total || 0,
                oj_count: task.oj_progress?.total || 0
              }))
              return
            }
          }
        }
        
        // 如果还是失败，显示错误
        throw err
      } else {
        throw err
      }
    }
  } catch (error: any) {
    console.error('获取任务列表失败:', error)
    if (error.response?.status === 404) {
      alert('获取任务列表失败: 接口不存在。请联系管理员。')
    } else if (error.response?.status === 403) {
      alert('获取任务列表失败: 您没有权限查看该计划的任务。')
    } else {
      alert('获取任务列表失败: ' + (error.response?.data?.message || error.message))
    }
    tasks.value = []
  } finally {
    tasksLoading.value = false
  }
}

// 查看任务完成情况 - 进入学生列表
const viewTaskProgress = async (task: any) => {
  if (!userInfo.value || !selectedPlan.value) return
  
  selectedTask.value = task
  studentsLoading.value = true
  
  try {
    // 获取该任务下所有学生的完成情况
    const response = await axios.get(
      `${BASE_URL}/learning-plans/${selectedPlan.value.id}/tasks/${task.id}/students-progress`,
      { params: { teacher_id: userInfo.value.id } }
    )
    
    if (response.data.success) {
      taskStudents.value = response.data.data?.students || response.data.data || []
    } else {
      alert('获取学生完成情况失败: ' + (response.data.message || '未知错误'))
      taskStudents.value = []
    }
  } catch (error: any) {
    console.error('获取学生完成情况失败:', error)
    // 如果接口不存在，尝试使用备用方法
    try {
      // 获取所有学生的计划进度，然后过滤出该任务的数据
      const studentsResponse = await axios.get(
        `${BASE_URL}/learning-plans/${selectedPlan.value.id}/students-progress`,
        { params: { teacher_id: userInfo.value.id } }
      )
      
      if (studentsResponse.data.success) {
        const allStudents = studentsResponse.data.data?.students || []
        // 为每个学生获取该任务的详细进度
        const studentsWithTaskProgress = await Promise.all(
          allStudents.map(async (student: any) => {
            try {
              const progressResponse = await axios.get(
                `${BASE_URL}/learning-plans/${selectedPlan.value.id}/students/${student.student_id}/progress`,
                { params: { teacher_id: userInfo.value.id } }
              )
              
              if (progressResponse.data.success) {
                const tasks = progressResponse.data.data?.tasks || []
                const taskDetail = tasks.find((t: any) => t.id === task.id)
                if (taskDetail) {
                  return {
                    ...student,
                    task_progress: taskDetail.task_progress,
                    exam_progress: taskDetail.exam_progress,
                    oj_progress: taskDetail.oj_progress
                  }
                }
              }
            } catch (err) {
              console.error(`获取学生 ${student.student_id} 的任务进度失败:`, err)
            }
            return {
              ...student,
              task_progress: { is_completed: false },
              exam_progress: { total: 0, completed: 0 },
              oj_progress: { total: 0, completed: 0 }
            }
          })
        )
        taskStudents.value = studentsWithTaskProgress
      } else {
        taskStudents.value = []
      }
    } catch (fallbackError: any) {
      console.error('备用方法也失败:', fallbackError)
      alert('获取学生完成情况失败: ' + (fallbackError.response?.data?.message || fallbackError.message))
      taskStudents.value = []
    }
  } finally {
    studentsLoading.value = false
  }
}

// 获取任务学生完成情况（用于导出）
const fetchTaskStudentsProgress = async (task: any) => {
  if (!userInfo.value || !selectedPlan.value) return []
  
  try {
    // 获取该任务下所有学生的完成情况
    const response = await axios.get(
      `${BASE_URL}/learning-plans/${selectedPlan.value.id}/tasks/${task.id}/students-progress`,
      { params: { teacher_id: userInfo.value.id } }
    )
    
    if (response.data.success) {
      return response.data.data?.students || response.data.data || []
    } else {
      throw new Error(response.data.message || '未知错误')
    }
  } catch (error: any) {
    console.error('获取学生完成情况失败:', error)
    // 如果接口不存在，尝试使用备用方法
    try {
      // 获取所有学生的计划进度，然后过滤出该任务的数据
      const studentsResponse = await axios.get(
        `${BASE_URL}/learning-plans/${selectedPlan.value.id}/students-progress`,
        { params: { teacher_id: userInfo.value.id } }
      )
      
      if (studentsResponse.data.success) {
        const allStudents = studentsResponse.data.data?.students || []
        // 为每个学生获取该任务的详细进度
        const studentsWithTaskProgress = await Promise.all(
          allStudents.map(async (student: any) => {
            try {
              const progressResponse = await axios.get(
                `${BASE_URL}/learning-plans/${selectedPlan.value.id}/students/${student.student_id}/progress`,
                { params: { teacher_id: userInfo.value.id } }
              )
              
              if (progressResponse.data.success) {
                const tasks = progressResponse.data.data?.tasks || []
                const taskDetail = tasks.find((t: any) => t.id === task.id)
                if (taskDetail) {
                  return {
                    ...student,
                    task_progress: taskDetail.task_progress,
                    exam_progress: taskDetail.exam_progress,
                    oj_progress: taskDetail.oj_progress
                  }
                }
              }
            } catch (err) {
              console.error(`获取学生 ${student.student_id} 的任务进度失败:`, err)
            }
            return {
              ...student,
              task_progress: { is_completed: false },
              exam_progress: { total: 0, completed: 0 },
              oj_progress: { total: 0, completed: 0 }
            }
          })
        )
        return studentsWithTaskProgress
      } else {
        return []
      }
    } catch (fallbackError: any) {
      console.error('备用方法也失败:', fallbackError)
      throw fallbackError
    }
  }
}

// 导出任务学生完成情况
const exportTaskProgress = async (task: any) => {
  if (!userInfo.value || !selectedPlan.value) return
  
  try {
    // 获取学生完成情况
    const students = await fetchTaskStudentsProgress(task)
    
    if (students.length === 0) {
      alert('该任务下暂无学生完成情况')
      return
    }
    
    const isExam = isExamMode(task)
    
    // 对学生列表进行排序（与显示列表相同的排序逻辑）
    const sortedStudents = [...students]
    if (isExam) {
      // 考试模式：按总分从高到低排序
      sortedStudents.sort((a: any, b: any) => {
        const scoreA = getStudentExamScore(a)
        const scoreB = getStudentExamScore(b)
        return scoreB - scoreA // 从高到低
      })
    } else {
      // 非考试模式：按完成情况排序（已完成的在前）
      sortedStudents.sort((a: any, b: any) => {
        const completedA = isCompleted(a.task_progress?.is_completed) ? 1 : 0
        const completedB = isCompleted(b.task_progress?.is_completed) ? 1 : 0
        return completedB - completedA // 已完成的在前
      })
    }
    
    // 准备 CSV 数据
    let csvContent = '\uFEFF' // BOM for UTF-8
    
    // 表头
    if (isExam) {
      csvContent += '学生姓名,用户名,任务完成情况,总分,客观题分数(50%),编程题1分数(25%),编程题2分数(25%),客观题进度,OJ题进度\n'
    } else {
      csvContent += '学生姓名,用户名,任务完成情况,客观题进度,OJ题进度\n'
    }
    
    // 数据行
    sortedStudents.forEach((student: any) => {
      const studentName = (student.real_name || student.username || '').replace(/,/g, '，')
      const username = (student.username || '').replace(/,/g, '，')
      
      // 计算进度
      const examCompleted = student.exam_progress?.completed || 
        (student.exam_progress?.exams ? student.exam_progress.exams.filter((e: any) => isCompleted(e.is_completed)).length : 0)
      const examTotal = student.exam_progress?.total || 
        (student.exam_progress?.exams ? student.exam_progress.exams.length : 0)
      const ojCompleted = student.oj_progress?.completed || 
        (student.oj_progress?.problems ? student.oj_progress.problems.filter((p: any) => isCompleted(p.is_completed)).length : 0)
      const ojTotal = student.oj_progress?.total || 
        (student.oj_progress?.problems ? student.oj_progress.problems.length : 0)
      
      // 任务完成情况：显示为"完成 1/1"或"进行中 0/1"格式
      const taskCompleted = isCompleted(student.task_progress?.is_completed)
      const taskStatus = taskCompleted ? `完成 ${examCompleted}/${examTotal}` : `进行中 ${examCompleted}/${examTotal}`
      
      if (isExam) {
        // 计算考试分数
        const score = getStudentExamScore(student)
        let examScore = 0
        let oj1Score = 0
        let oj2Score = 0
        
        if (student.exam_progress?.exams && student.exam_progress.exams.length > 0) {
          const firstExam = student.exam_progress.exams[0]
          if (firstExam.best_score !== null && firstExam.best_score !== undefined) {
            examScore = Number(firstExam.best_score) || 0
          }
        }
        
        if (student.oj_progress?.problems && student.oj_progress.problems.length >= 1) {
          oj1Score = getOJScore(student.oj_progress.problems[0])
        }
        if (student.oj_progress?.problems && student.oj_progress.problems.length >= 2) {
          oj2Score = getOJScore(student.oj_progress.problems[1])
        }
        
        // 格式化进度显示
        const examProgressText = formatProgress(student.exam_progress)
        const ojProgressText = formatProgress(student.oj_progress)
        
        csvContent += `${studentName},${username},${taskStatus},${score >= 0 ? score : '-'},${examScore},${oj1Score},${oj2Score},${examProgressText},${ojProgressText}\n`
      } else {
        // 格式化进度显示
        const examProgressText = formatProgress(student.exam_progress)
        const ojProgressText = formatProgress(student.oj_progress)
        
        csvContent += `${studentName},${username},${taskStatus},${examProgressText},${ojProgressText}\n`
      }
    })
    
    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    // 生成文件名
    const planName = (selectedPlan.value.name || '计划').replace(/[\/\\:*?"<>|]/g, '_')
    const taskName = (task.name || '任务').replace(/[\/\\:*?"<>|]/g, '_')
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `${planName}_${taskName}_学生完成情况_${timestamp}.csv`
    
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    alert('导出成功！文件已下载到您的设备。')
  } catch (error: any) {
    console.error('导出失败:', error)
    alert('导出失败: ' + (error.response?.data?.message || error.message))
  }
}

// 查看任务学生详细完成情况
const viewTaskStudentDetail = async (student: any) => {
  if (!userInfo.value || !selectedPlan.value || !selectedTask.value) return
  
  selectedTaskStudent.value = student
  showTaskStudentDetailDialog.value = true
  taskStudentDetailLoading.value = true
  
  try {
    // 获取该学生在该任务下的详细进度
    const response = await axios.get(
      `${BASE_URL}/learning-plans/${selectedPlan.value.id}/students/${student.student_id}/progress`,
      { params: { teacher_id: userInfo.value.id } }
    )
    
    if (response.data.success) {
      const tasks = response.data.data?.tasks || []
      const taskDetail = tasks.find((t: any) => t.id === selectedTask.value.id)
      if (taskDetail) {
        taskStudentDetail.value = {
          student: student,
          task: {
            ...selectedTask.value,
            is_exam_mode: taskDetail.is_exam_mode || selectedTask.value.is_exam_mode
          },
          exam_progress: taskDetail.exam_progress?.exams || [],
          oj_progress: taskDetail.oj_progress?.problems || []
        }
      } else {
        taskStudentDetail.value = {
          student: student,
          task: selectedTask.value,
          exam_progress: [],
          oj_progress: []
        }
      }
    } else {
      alert('获取学生详细完成情况失败: ' + (response.data.message || '未知错误'))
      taskStudentDetail.value = null
    }
  } catch (error: any) {
    console.error('获取学生详细完成情况失败:', error)
    alert('获取学生详细完成情况失败: ' + (error.response?.data?.message || error.message))
    taskStudentDetail.value = null
  } finally {
    taskStudentDetailLoading.value = false
  }
}

// 关闭任务学生详细完成情况对话框
const closeTaskStudentDetailDialog = () => {
  showTaskStudentDetailDialog.value = false
  selectedTaskStudent.value = null
  taskStudentDetail.value = null
}

// 查看客观题提交
const viewExamSubmissions = (exam: any) => {
  if (!userInfo.value || !selectedTaskStudent.value || !selectedTask.value || !selectedPlan.value) return
  
  // 保存当前状态到 localStorage
  saveCurrentState()
  
  // 跳转到 StudentSubmissionsView，传递 exam_id、student_id 和 task_id
  router.push({
    path: `/teacher/${userInfo.value.id}/submissions`,
    query: { 
      exam_id: exam.id.toString(),
      student_id: selectedTaskStudent.value.student_id.toString(),
      task_id: selectedTask.value.id.toString(),
      fromSection: 'plan-progress',
      fromTeacherView: 'true',
      planId: selectedPlan.value.id.toString(),
      taskId: selectedTask.value.id.toString()
    }
  })
}

// 查看OJ题提交
const viewOJSubmissions = (problem: any) => {
  if (!userInfo.value || !selectedTaskStudent.value || !selectedTask.value || !selectedPlan.value) return
  
  // 保存当前状态到 localStorage
  saveCurrentState()
  
  // 跳转到 TeacherOJSubmissionsView，传递 problem_id、student_id 和 task_id
  router.push({
    path: `/teacher/${userInfo.value.id}/oj-submissions/${problem.id}`,
    query: { 
      student_id: selectedTaskStudent.value.student_id.toString(),
      task_id: selectedTask.value.id.toString(),
      fromSection: 'plan-progress',
      fromTeacherView: 'true',
      planId: selectedPlan.value.id.toString(),
      taskId: selectedTask.value.id.toString()
    }
  })
}

// 判断是否完成（处理数字和布尔值）
const isCompleted = (value: any): boolean => {
  if (value === true || value === 1) return true
  if (value === false || value === 0 || value === null || value === undefined) return false
  // 处理字符串类型
  if (typeof value === 'string') {
    return value === '1' || value === 'true' || value.toLowerCase() === 'true'
  }
  return false
}

// 判断任务是否为考试模式
const isExamMode = (task: any): boolean => {
  if (!task) return false
  return task.is_exam_mode === true || task.is_exam_mode === 1 || task.is_exam_mode === '1'
}

// 计算OJ题目分数（根据通过率）
const getOJScore = (problem: any): number => {
  if (!problem || !problem.best_verdict) return 0
  if (problem.best_verdict === 'Accepted' || problem.best_verdict === 'AC') return 100
  // PAC (Partial Accepted) - 使用 best_pass_rate 字段
  if (problem.best_pass_rate !== undefined && problem.best_pass_rate !== null) {
    return Math.round(Number(problem.best_pass_rate)) || 0
  }
  return 0
}

// 计算考试模式总分
const getExamModeScore = (taskStudentDetail: any) => {
  if (!taskStudentDetail || !isExamMode(taskStudentDetail.task)) return null
  
  const exams = taskStudentDetail.exam_progress || []
  const ojProblems = taskStudentDetail.oj_progress || []
  
  // 客观题分数（占50%）- 取第一套试卷的最高分
  let examScore = 0
  if (exams.length > 0 && exams[0].best_score !== undefined && exams[0].best_score !== null) {
    examScore = Number(exams[0].best_score) || 0
  }
  
  // 编程题分数（每道各占25%）- AC为100分，PAC按通过率计算
  let oj1Score = 0
  let oj2Score = 0
  if (ojProblems.length >= 1) {
    oj1Score = getOJScore(ojProblems[0])
  }
  if (ojProblems.length >= 2) {
    oj2Score = getOJScore(ojProblems[1])
  }
  
  // 计算总分：客观题50% + 编程题1 25% + 编程题2 25%
  const totalScore = examScore * 0.5 + oj1Score * 0.25 + oj2Score * 0.25
  
  return {
    total: Math.round(totalScore * 10) / 10,
    examScore,
    oj1Score,
    oj2Score,
    hasExamSubmission: exams.length > 0 && exams[0].best_score !== undefined && exams[0].best_score !== null,
    hasOJ1Submission: ojProblems.length >= 1 && ojProblems[0].best_verdict,
    hasOJ2Submission: ojProblems.length >= 2 && ojProblems[1].best_verdict
  }
}

// 排序后的客观题列表
const sortedExamProgress = computed(() => {
  if (!taskStudentDetail.value || !taskStudentDetail.value.exam_progress) return []
  
  const exams = [...taskStudentDetail.value.exam_progress]
  const isExam = isExamMode(taskStudentDetail.value.task)
  
  if (isExam) {
    // 考试模式：按分数从高到低排序
    return exams.sort((a: any, b: any) => {
      const scoreA = a.best_score !== null && a.best_score !== undefined ? Number(a.best_score) : -1
      const scoreB = b.best_score !== null && b.best_score !== undefined ? Number(b.best_score) : -1
      return scoreB - scoreA // 从高到低
    })
  } else {
    // 非考试模式：按完成情况排序（已完成的在前）
    return exams.sort((a: any, b: any) => {
      const completedA = isCompleted(a.is_completed) ? 1 : 0
      const completedB = isCompleted(b.is_completed) ? 1 : 0
      return completedB - completedA // 已完成的在前
    })
  }
})

// 排序后的OJ题列表
const sortedOJProgress = computed(() => {
  if (!taskStudentDetail.value || !taskStudentDetail.value.oj_progress) return []
  
  const problems = [...taskStudentDetail.value.oj_progress]
  const isExam = isExamMode(taskStudentDetail.value.task)
  
  if (isExam) {
    // 考试模式：按分数从高到低排序
    return problems.sort((a: any, b: any) => {
      const scoreA = getOJScore(a)
      const scoreB = getOJScore(b)
      return scoreB - scoreA // 从高到低
    })
  } else {
    // 非考试模式：按完成情况排序（已完成的在前）
    return problems.sort((a: any, b: any) => {
      const completedA = isCompleted(a.is_completed) ? 1 : 0
      const completedB = isCompleted(b.is_completed) ? 1 : 0
      return completedB - completedA // 已完成的在前
    })
  }
})

// 计算学生的考试模式总分
const getStudentExamScore = (student: any): number => {
  if (!selectedTask.value || !isExamMode(selectedTask.value)) return -1
  
  // 从学生的任务进度中获取客观题和OJ题数据
  const examProgress = student.exam_progress
  const ojProgress = student.oj_progress
  
  // 客观题分数（占50%）- 取第一套试卷的最高分
  let examScore = 0
  if (examProgress?.exams && examProgress.exams.length > 0) {
    const firstExam = examProgress.exams[0]
    if (firstExam.best_score !== null && firstExam.best_score !== undefined) {
      examScore = Number(firstExam.best_score) || 0
    }
  }
  
  // 编程题分数（每道各占25%）
  let oj1Score = 0
  let oj2Score = 0
  if (ojProgress?.problems && ojProgress.problems.length >= 1) {
    oj1Score = getOJScore(ojProgress.problems[0])
  }
  if (ojProgress?.problems && ojProgress.problems.length >= 2) {
    oj2Score = getOJScore(ojProgress.problems[1])
  }
  
  // 计算总分：客观题50% + 编程题1 25% + 编程题2 25%
  const totalScore = examScore * 0.5 + oj1Score * 0.25 + oj2Score * 0.25
  return Math.round(totalScore * 10) / 10
}

// 排序后的学生列表
const sortedTaskStudents = computed(() => {
  if (!taskStudents.value || taskStudents.value.length === 0) return []
  
  const students = [...taskStudents.value]
  const isExam = selectedTask.value && isExamMode(selectedTask.value)
  
  if (isExam) {
    // 考试模式：按总分从高到低排序
    return students.sort((a: any, b: any) => {
      const scoreA = getStudentExamScore(a)
      const scoreB = getStudentExamScore(b)
      return scoreB - scoreA // 从高到低
    })
  } else {
    // 非考试模式：按完成情况排序（已完成的在前）
    return students.sort((a: any, b: any) => {
      const completedA = isCompleted(a.task_progress?.is_completed) ? 1 : 0
      const completedB = isCompleted(b.task_progress?.is_completed) ? 1 : 0
      return completedB - completedA // 已完成的在前
    })
  }
})

// 获取OJ判题结果样式类
const getVerdictClass = (verdict: string) => {
  if (verdict === 'AC' || verdict === 'Accepted') return 'verdict-ac'
  if (verdict === 'WA' || verdict === 'Wrong Answer') return 'verdict-wa'
  if (verdict === 'TLE' || verdict === 'Time Limit Exceeded') return 'verdict-tle'
  if (verdict === 'RE' || verdict === 'Runtime Error') return 'verdict-re'
  return 'verdict-other'
}

// 获取OJ判题结果文本
const getVerdictText = (verdict: string) => {
  const verdictMap: Record<string, string> = {
    'AC': '通过',
    'Accepted': '通过',
    'WA': '答案错误',
    'Wrong Answer': '答案错误',
    'TLE': '超时',
    'Time Limit Exceeded': '超时',
    'RE': '运行错误',
    'Runtime Error': '运行错误',
    'CE': '编译错误',
    'Compilation Error': '编译错误'
  }
  return verdictMap[verdict] || verdict
}

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatScore = (score: any): string => {
  const n = Number(score)
  if (!Number.isFinite(n)) return '0'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// 格式化进度显示（显示为"完成 X/Y"格式）
const formatProgress = (progress: any): string => {
  if (!progress) return '完成 0/0'
  
  let completed = 0
  let total = 0
  
  // 如果直接有 completed 和 total 字段
  if (progress.completed !== undefined && progress.total !== undefined) {
    completed = progress.completed
    total = progress.total
  } 
  // 如果有 exams 或 problems 数组
  else if (progress.exams) {
    completed = progress.exams.filter((e: any) => isCompleted(e.is_completed)).length
    total = progress.exams.length
  } else if (progress.problems) {
    completed = progress.problems.filter((p: any) => isCompleted(p.is_completed)).length
    total = progress.problems.length
  }
  
  return `完成 ${completed}/${total}`
}

// 获取状态样式类
const getStatusClass = (plan: any) => {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  
  if (now < start) return 'status-upcoming'
  if (now > end) return 'status-ended'
  return 'status-active'
}

// 获取状态文本
const getStatusText = (plan: any) => {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  
  if (now < start) return '未开始'
  if (now > end) return '已结束'
  return '进行中'
}

// 获取进度样式类
const getProgressClass = (rate: number) => {
  if (rate >= 100) return 'progress-completed'
  if (rate >= 80) return 'progress-good'
  if (rate >= 50) return 'progress-medium'
  return 'progress-low'
}

// 保存当前状态
const saveCurrentState = () => {
  if (selectedPlan.value) {
    localStorage.setItem('planProgress_planId', selectedPlan.value.id.toString())
  }
  if (selectedTask.value) {
    localStorage.setItem('planProgress_taskId', selectedTask.value.id.toString())
  }
  if (selectedLevel.value) {
    localStorage.setItem('planProgress_level', selectedLevel.value)
  }
}

// 恢复状态
const restoreState = async () => {
  if (!userInfo.value) return
  
  // 如果已经有选中的计划，不重复恢复
  if (selectedPlan.value) {
    return
  }
  
  // 优先从路由查询参数恢复
  const fromSection = route.query.fromSection as string
  const planIdFromQuery = route.query.planId as string
  const taskIdFromQuery = route.query.taskId as string
  
  if (fromSection === 'plan-progress' && planIdFromQuery) {
    // 从查询参数恢复
    try {
      const planId = parseInt(planIdFromQuery)
      const plansResponse = await axios.get(`${BASE_URL}/learning-plans/all`, {
        params: { is_active: '1' }
      })
      
      if (plansResponse.data.success) {
        const plansList = plansResponse.data.data || []
        const plan = plansList.find((p: any) => p.id === planId)
        if (plan) {
          // 先设置计划，然后加载任务列表
          selectedPlan.value = plan
          selectedTask.value = null
          
          // 加载任务列表
          await viewPlanProgress(plan)
          
          // 等待任务列表加载完成
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // 如果有任务ID，恢复任务
          if (taskIdFromQuery && tasks.value.length > 0) {
            const taskId = parseInt(taskIdFromQuery)
            const task = tasks.value.find((t: any) => t.id === taskId)
            if (task) {
              await viewTaskProgress(task)
            }
          }
        }
      }
    } catch (error) {
      console.error('从查询参数恢复状态失败:', error)
    }
    return
  }
  
  // 从 localStorage 恢复
  const savedPlanId = localStorage.getItem('planProgress_planId')
  const savedTaskId = localStorage.getItem('planProgress_taskId')
  const savedLevel = localStorage.getItem('planProgress_level')
  
  if (savedLevel) {
    selectedLevel.value = savedLevel
  }
  
  if (savedPlanId && userInfo.value) {
    try {
      const planId = parseInt(savedPlanId)
      const plansResponse = await axios.get(`${BASE_URL}/learning-plans/all`, {
        params: { is_active: '1', level: savedLevel || '' }
      })
      
      if (plansResponse.data.success) {
        const plansList = plansResponse.data.data || []
        const plan = plansList.find((p: any) => p.id === planId)
        if (plan) {
          // 先设置计划，然后加载任务列表
          selectedPlan.value = plan
          selectedTask.value = null
          
          // 加载任务列表
          await viewPlanProgress(plan)
          
          // 等待任务列表加载完成
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // 如果有保存的任务ID，恢复任务
          if (savedTaskId && tasks.value.length > 0) {
            const taskId = parseInt(savedTaskId)
            const task = tasks.value.find((t: any) => t.id === taskId)
            if (task) {
              await viewTaskProgress(task)
            }
          }
        }
      }
    } catch (error) {
      console.error('恢复状态失败:', error)
    }
  }
}

// 初始化
onMounted(() => {
  getUserInfo()
  if (userInfo.value) {
    fetchPlans().then(() => {
      // 延迟恢复状态，确保计划列表已加载
      setTimeout(() => {
        restoreState()
      }, 100)
    })
  }
})

// 监听用户信息变化
watch(userInfo, (newUserInfo) => {
  if (newUserInfo && !selectedPlan.value) {
    fetchPlans().then(() => {
      setTimeout(() => {
        restoreState()
      }, 100)
    })
  }
})

// 监听路由查询参数变化
watch(() => route.query.fromSection, (fromSection) => {
  if (fromSection === 'plan-progress' && userInfo.value && !selectedPlan.value) {
    setTimeout(() => {
      restoreState()
    }, 100)
  }
}, { immediate: true })
</script>

<style scoped>
.progress-filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
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

.empty-state p {
  margin: 0;
  color: #64748b;
  font-size: 16px;
}

.table-container {
  width: 100%;
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  overflow: hidden;
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

.plan-name-cell,
.student-name-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plan-name-text,
.student-name-text,
.task-name-text {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

.task-description {
  color: #64748b;
  font-size: 14px;
}

.count-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: #e0e7ff;
  color: #3730a3;
}

.tasks-progress-container {
  margin-top: 24px;
}

.level-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: #e0e7ff;
  color: #3730a3;
}

.date-cell {
  color: #64748b;
  font-size: 13px;
}

.username-text {
  color: #64748b;
  font-size: 14px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.in-progress {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.status-upcoming {
  background: #e0e7ff;
  color: #3730a3;
}

.status-badge.status-active {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.status-ended {
  background: #fee2e2;
  color: #991b1b;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-text {
  font-weight: 500;
  color: #1e293b;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.progress-bar {
  height: 8px;
  border-radius: 4px;
  background: #e2e8f0;
  position: relative;
  flex: 1;
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-bar.progress-completed .progress-fill {
  background: #10b981;
}

.progress-bar.progress-good .progress-fill {
  background: #3b82f6;
}

.progress-bar.progress-medium .progress-fill {
  background: #f59e0b;
}

.progress-bar.progress-low .progress-fill {
  background: #ef4444;
}

.progress-percentage {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  min-width: 40px;
}

.btn-action {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
}

.btn-view {
  background: #0ea5e9;
  color: white;
}

.btn-view:hover {
  background: #0284c7;
  transform: translateY(-1px);
}

/* 计划信息卡片 */
.plan-info-card {
  background: white;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  padding: 24px;
  margin-bottom: 24px;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.plan-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 20px;
  font-weight: 600;
}

.btn-back {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn-back:hover {
  background: #e2e8f0;
  color: #475569;
}

.plan-meta {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.meta-item {
  color: #64748b;
  font-size: 14px;
}

.students-progress-container {
  margin-top: 24px;
}

.student-aggregate-container,
.student-plan-detail,
.student-task-detail-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.student-plan-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 760px;
}

.student-plan-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 360px;
  padding: 7px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.student-plan-chip:hover {
  background: #dbeafe;
  border-color: #60a5fa;
  transform: translateY(-1px);
}

.student-plan-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-plan-chip-progress {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  background: #ffffff;
  color: #1e40af;
  font-size: 12px;
}

.empty-plan-text {
  color: #94a3b8;
}

.student-task-card {
  padding: 18px;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
}

.task-progress-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}

.task-progress-summary span {
  padding: 6px 10px;
  border-radius: 8px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 13px;
  font-weight: 700;
}

.exercise-subsection {
  margin-top: 14px;
}

.exercise-subsection h5 {
  margin: 0 0 10px 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.exercise-list-compact {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.exercise-compact-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
}

.exercise-compact-name {
  color: #0f172a;
  font-weight: 700;
}

.exercise-compact-meta {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.exercise-compact-score {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #0f172a;
  font-weight: 800;
  white-space: nowrap;
}

.score-status-badge {
  padding: 5px 9px;
  border-radius: 999px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 13px;
  font-weight: 800;
}

.score-status-badge.completed {
  background: #dbeafe;
  color: #1d4ed8;
}

.empty-task-exercises {
  margin-top: 12px;
  color: #94a3b8;
  font-size: 14px;
}

/* 导出操作区域 */
.export-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-large {
  max-width: 900px;
}

.dialog-xlarge {
  max-width: 1200px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.dialog-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.btn-close:hover {
  background: #f1f5f9;
  color: #475569;
}

.dialog-body {
  padding: 24px;
}

.student-detail-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.progress-overview {
  background: #f8fafc;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.progress-overview h4 {
  margin: 0 0 16px 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.overview-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.overview-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
  font-weight: 500;
}

.overview-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e90ff;
}

.tasks-section {
  background: #f8fafc;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.tasks-section h4 {
  margin: 0 0 16px 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 16px;
}

.task-status-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.task-status-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.task-status-badge.in-progress {
  background: #fef3c7;
  color: #92400e;
}

.task-progress-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
  min-width: 60px;
}

.progress-detail {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.progress-count {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  min-width: 60px;
}

.mini-progress-bar {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: #1e90ff;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.btn-secondary {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #475569;
}

/* 任务操作按钮组 */
.task-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-view-task {
  background: #0ea5e9;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-view-task:hover {
  background: #0284c7;
  transform: translateY(-1px);
}

/* 任务详情对话框样式 */
.task-detail-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.task-info-section,
.exams-section,
.oj-problems-section {
  background: #f8fafc;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.task-info-section h4,
.exams-section h4,
.oj-problems-section h4 {
  margin: 0 0 16px 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 8px;
}

.info-card {
  background: white;
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

/* 客观题列表样式 */
.exams-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exam-item {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.3s ease;
}

.exam-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.exam-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.exam-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.exam-score-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.exam-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 16px;
}

.exam-status-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.exam-status-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.exam-status-badge.in-progress {
  background: #fef3c7;
  color: #92400e;
}

.exam-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.exam-level-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: #e0e7ff;
  color: #3730a3;
}

.exam-type-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.exam-type-badge.type-真题 {
  background: #e0f7fa;
  color: #1e90ff;
}

.exam-type-badge.type-模拟 {
  background: #fef3c7;
  color: #d97706;
}

.exam-type-badge.type-专项 {
  background: #d1fae5;
  color: #065f46;
}

.exam-score {
  font-size: 14px;
  color: #1e90ff;
  font-weight: 600;
}

.exam-attempts {
  font-size: 14px;
  color: #64748b;
}

.exam-action {
  display: flex;
  justify-content: flex-end;
}

/* OJ题列表样式 */
.oj-problems-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.oj-problem-item {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.3s ease;
}

.oj-problem-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.oj-problem-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.oj-problem-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.oj-problem-score-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.oj-problem-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 16px;
}

.oj-problem-status-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.oj-problem-status-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.oj-problem-status-badge.in-progress {
  background: #fef3c7;
  color: #92400e;
}

.oj-problem-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.oj-problem-level-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: #e0e7ff;
  color: #3730a3;
}

.oj-problem-verdict {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.oj-problem-verdict.verdict-ac {
  background: #d1fae5;
  color: #065f46;
}

.oj-problem-verdict.verdict-wa {
  background: #fee2e2;
  color: #991b1b;
}

.oj-problem-verdict.verdict-tle {
  background: #fef3c7;
  color: #92400e;
}

.oj-problem-verdict.verdict-re {
  background: #fee2e2;
  color: #991b1b;
}

.oj-problem-verdict.verdict-other {
  background: #f1f5f9;
  color: #64748b;
}

.oj-problem-attempts {
  font-size: 14px;
  color: #64748b;
}

.oj-problem-action {
  display: flex;
  justify-content: flex-end;
}

/* 考试模式总分面板样式 */
.exam-score-panel {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 3px solid #10b981;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.score-panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #a7f3d0;
}

.score-panel-header :deep(.lucide-icon) {
  color: #059669;
}

.score-panel-header h3 {
  margin: 0;
  color: #047857;
  font-size: 1.4rem;
  font-weight: 700;
}

.score-panel-body {
  display: flex;
  align-items: center;
  gap: 40px;
  flex-wrap: wrap;
}

.total-score-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 40px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.total-score-value {
  font-size: 3rem;
  font-weight: 800;
  color: white;
  line-height: 1;
}

.total-score-label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  margin-top: 8px;
}

.score-breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.score-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  border: 1px solid #a7f3d0;
}

.score-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #047857;
  font-weight: 600;
  font-size: 0.95rem;
}

.score-item-header :deep(.lucide-icon) {
  color: #10b981;
}

.score-item-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #059669;
  padding: 4px 12px;
  background: #d1fae5;
  border-radius: 8px;
}

.score-item-value.no-submission {
  color: #9ca3af;
  background: #f3f4f6;
}

.score-item-value.score-perfect {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.score-item-value.score-partial {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

/* 学生分数徽章样式 */
.student-score-badge {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  display: inline-block;
}

/* 考试模式标签样式 */
.exam-mode-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  margin-top: 4px;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.exam-mode-tag :deep(.lucide-icon) {
  color: white;
}

.btn-export {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
}

.btn-export:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-export :deep(.lucide-icon) {
  color: white;
}
</style>
