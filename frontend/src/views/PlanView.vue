<template>
  <div class="exam-layout">
    <div class="exam-content exam-content-flex-row">
      <!-- 主体：计划内容 -->
      <div class="question-main">
        <div class="question-card" :class="{ 'plan-view-transparent': currentView === 'plans' }">
          <div class="question-card-header">
            <div class="header-left-section">
              <button v-if="currentView === 'tasks'" class="back-btn-header" @click="backToPlans">
                &lt;- 返回计划
              </button>
              <button v-if="currentView === 'exercises'" class="back-btn-header" @click="backToTasks">
                &lt;- 返回任务
              </button>
            </div>
            <div class="header-center-section">
              <span v-if="currentView !== 'plans'" class="number-badge">
                {{ currentView === 'tasks' ? '学习任务' : '练习详情' }}
              </span>
            </div>
            <div class="header-right-section">
              <span class="level-badge" v-if="selectedLevel">GESP {{ selectedLevel }}级</span>
            </div>
          </div>

          <!-- 统一的内容滚动区域 -->
          <div class="question-content-unified">
            <div class="question-left-panel question-left-panel-centered" style="width: 100%;">
              
              <!-- 侧边栏视图：计划排名 -->
              <div v-if="sidebarView === 'global-ranking'" class="global-ranking-view">
                <!-- 错误状态 -->
                <div v-if="globalRankingError" class="content-section error-state">
                  <div class="section-content">
                    <div class="error-icon"><Icon name="alert-triangle" :size="80" /></div>
                    <h3>连接错误</h3>
                    <p>{{ globalRankingError }}</p>
                    <button @click="fetchAllPlans" class="retry-btn">
                      <Icon name="refresh-cw" :size="16" /> 重试
                    </button>
                  </div>
                </div>
                
                <!-- 加载状态 -->
                <div v-else-if="globalRankingLoading" class="content-section loading-state">
                  <div class="section-content">
                    <div class="loading-icon"><Icon name="loader-2" :size="80" spin /></div>
                    <h3>加载中...</h3>
                    <p>正在获取计划排名数据</p>
                  </div>
                </div>
                
                <!-- 如果没有计划 -->
                <div v-else-if="allPlansForRanking.length === 0" class="content-section empty-state">
                  <div class="section-content">
                    <div class="empty-icon"><Icon name="trophy" :size="80" /></div>
                    <h3>暂无排名数据</h3>
                    <p>当前没有可查看的计划排名</p>
                  </div>
                </div>
                
                <!-- 所有计划列表 -->
                <div v-else class="content-section">
                  <div class="section-header">
                    <h4 class="section-title"><Icon name="trophy" :size="18" /> 计划排名列表</h4>
                  </div>
                  <div class="section-content">
                    <div class="global-ranking-plans-list">
                      <div class="global-ranking-list-header">
                        <div class="plan-name-col">计划名称</div>
                        <div class="plan-level-col">级别</div>
                        <div class="plan-status-col">状态</div>
                        <div class="plan-time-col">时间范围</div>
                        <div class="plan-action-col">操作</div>
                      </div>
                      <div 
                        v-for="plan in allPlansForRanking" 
                        :key="plan.id"
                        class="global-ranking-list-row"
                        :class="{ 'is-my-plan': myPlans.some(p => p.id === plan.id) }"
                        @click="showGlobalRanking(plan)"
                      >
                        <div class="plan-name-col">
                          <div class="plan-name-header">
                            <h4 class="plan-name">{{ plan.name }}</h4>
                            <div class="plan-name-badges">
                              <span v-if="myPlans.some(p => p.id === plan.id)" class="joined-badge">
                                <Icon name="check-circle" :size="16" />
                                已加入
                              </span>
                              <!-- 排名信息延迟加载：只在弹窗打开后才会显示（从缓存中读取） -->
                              <span v-if="plan.my_rank && myPlans.some(p => p.id === plan.id)" class="rank-badge" :class="getRankingBadgeClass(plan.my_rank)">
                                <Icon name="award" :size="14" />
                                第{{ plan.my_rank }}名
                              </span>
                            </div>
                          </div>
                          <p class="plan-desc-text" v-if="plan.description">{{ plan.description }}</p>
                        </div>
                        <div class="plan-level-col">
                          <div class="plan-level-badge-list">GESP {{ plan.level }}级</div>
                        </div>
                        <div class="plan-status-col">
                          <div class="plan-status-badge-list" :class="getPlanStatusClass(plan)">
                            {{ getPlanStatusText(plan) }}
                          </div>
                        </div>
                        <div class="plan-time-col">
                          <div class="plan-time-text">
                            <Icon name="calendar" :size="16" />
                            {{ formatDate(plan.start_time) }} - {{ formatDate(plan.end_time) }}
                          </div>
                        </div>
                        <div class="plan-action-col">
                          <button class="ranking-btn-list" @click.stop="showGlobalRanking(plan)">
                            <Icon name="trophy" :size="16" /> 查看排名
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 侧边栏视图：我的提交 -->
              <div v-if="sidebarView === 'my-submissions'" class="my-submissions-view-wrap">
                <MySubmissionsSection />
              </div>
              <!-- 侧边栏视图：学生提交（仅教师可见，展示绑定学生的编程题与客观题提交） -->
              <div v-if="sidebarView === 'student-submissions'" class="my-submissions-view-wrap">
                <MySubmissionsSection mode="students" :teacher-id="userInfo?.id ?? 0" />
              </div>

              <!-- 侧边栏视图：我的测试 -->
              <div v-if="sidebarView === 'my-tests'" class="my-tests-view">
                <div v-if="testsLoading" class="content-section loading-state">
                  <div class="section-content">
                    <div class="loading-icon"><Icon name="loader-2" :size="80" spin /></div>
                    <h3>加载中...</h3>
                  </div>
                </div>
                <div v-else-if="testsList.length === 0" class="content-section empty-state">
                  <div class="section-content">
                    <div class="empty-icon"><Icon name="clipboard-list" :size="80" /></div>
                    <h3>暂无测试</h3>
                    <p>当前没有可参加的测试</p>
                  </div>
                </div>
                <div v-else class="content-section">
                  <div class="section-header">
                    <h4 class="section-title"><Icon name="clipboard-list" :size="18" /> 可参加的测试</h4>
                  </div>
                  <div class="section-content">
                    <div class="tests-list">
                      <div 
                        v-for="t in testsList" 
                        :key="t.id"
                        class="test-card"
                      >
                        <div class="test-card-header">
                          <h4>{{ t.name }}</h4>
                          <span v-if="t.submitted_at" class="test-status submitted">已交卷</span>
                          <span v-else-if="t.has_attempt" class="test-status in-progress">进行中</span>
                          <span v-else class="test-status not-started">未开始</span>
                        </div>
                        <p v-if="t.description" class="test-card-desc">{{ t.description }}</p>
                        <div class="test-card-meta">
                          <span>限时 {{ t.time_limit_minutes }} 分钟</span>
                          <span v-if="t.total_score">满分 {{ t.total_score }}</span>
                        </div>
                        <div class="test-card-actions">
                          <button 
                            v-if="!t.has_attempt" 
                            class="test-btn primary" 
                            @click="goToTest(t.id, 'start')"
                          >
                            开始考试
                          </button>
                          <button 
                            v-else-if="!t.submitted_at" 
                            class="test-btn primary" 
                            @click="goToTest(t.id, 'continue')"
                          >
                            继续考试
                          </button>
                          <button 
                            v-else 
                            class="test-btn secondary" 
                            @click="goToTest(t.id, 'result')"
                          >
                            查看结果
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 侧边栏视图：我的计划 -->
              <div v-if="sidebarView === 'my-plans'">
                <!-- GESP考级备考阶段横幅（计划页顶部） -->
                <div v-if="currentView === 'plans'" class="preparation-banner">
                  <div class="banner-content">
                    <Icon name="info" :size="20" />
                    <div class="banner-text">
                      <strong>GESP考级备考阶段</strong>
                      <span>欢迎大家来到信奥成长计划，我们2月2日-3月14日为GESP考级备考阶段，大家寒假期间练习辛苦啦！这次成长计划进行了升级，我们在后台增加了AI检测功能，将会对异常的提交情况进行判定，所以也请同学们认真作答哦～</span>
                    </div>
                  </div>
                </div>
                <!-- 视图1: 我的学习计划列表 -->
                <div v-if="currentView === 'plans'" class="plans-list-view">
                <!-- 错误状态 -->
                <div v-if="error" class="content-section error-state">
                  <div class="section-content">
                    <div class="error-icon"><Icon name="alert-triangle" :size="80" /></div>
                    <h3>连接错误</h3>
                    <p>{{ error }}</p>
                    <button @click="fetchMyPlans" class="retry-btn">
                      <Icon name="refresh-cw" :size="16" /> 重试
                    </button>
                </div>
                </div>
                
                <!-- 加载状态 -->
                <div v-else-if="loading" class="content-section loading-state">
                <div class="section-content">
                    <div class="loading-icon"><Icon name="loader-2" :size="80" spin /></div>
                    <h3>加载中...</h3>
                    <p>正在获取学习计划数据</p>
                  </div>
                  </div>
                  
                <!-- 如果没有加入任何计划 -->
                <div v-else-if="myPlans.length === 0" class="content-section empty-state">
                <div class="section-content">
                    <div class="empty-icon"><Icon name="book-open" :size="80" /></div>
                    <h3>暂无学习计划</h3>
                    <p v-if="isTeacherOrAdmin">加入计划开始你的学习之旅</p>
                    <p v-else>请联系老师加入学习计划</p>
                    <button v-if="isTeacherOrAdmin" class="join-plan-btn-inline" @click="showJoinDialog = true">
                      <Icon name="plus" :size="20" /> 加入计划
                    </button>
                  </div>
                  </div>

                <!-- 我的计划列表（含顶部加入计划按钮） -->
                <div v-else class="my-plans-with-header">
                  <div v-if="isTeacherOrAdmin" class="my-plans-header-actions">
                    <button class="join-plan-btn-inline" @click="showJoinDialog = true">
                      <Icon name="plus" :size="18" /> 加入计划
                    </button>
                  </div>
                <div class="my-plans-grid">
                    <div 
                    v-for="plan in myPlans" 
                      :key="plan.id"
                    class="plan-card"
                    @click="enterPlan(plan)"
                  >
                    <div class="plan-card-header">
                      <div class="plan-level-badge">GESP {{ plan.level }}级</div>
                      <div class="plan-status-badge" :class="getPlanStatusClass(plan)">
                        {{ getPlanStatusText(plan) }}
                      </div>
                    </div>
                    <div class="plan-card-body">
                      <h3>{{ plan.name }}</h3>
                      <p class="plan-desc">{{ plan.description }}</p>
                      <div class="plan-time">
                        <Icon name="calendar" :size="16" />
                        {{ formatDate(plan.start_time) }} - {{ formatDate(plan.end_time) }}
                      </div>
                      <div class="plan-progress">
                        <div class="progress-bar-container">
                          <div class="progress-bar-fill" :style="{ width: plan.progress + '%' }"></div>
                    </div>
                        <div class="progress-text">
                          完成进度: {{ plan.completed_tasks }}/{{ plan.total_tasks }} ({{ plan.progress }}%)
                  </div>
                      </div>
                    </div>
                    <div class="plan-card-footer">
                      <button class="enter-plan-btn" @click.stop="enterPlan(plan)">
                        <Icon name="eye" :size="16" /> 查看任务 <Icon name="arrow-right" :size="16" />
                    </button>
                  </div>
                  </div>
                </div>
                </div>
              </div>

              <!-- 视图2: 计划的任务列表 -->
              <div v-if="sidebarView === 'my-plans' && currentView === 'tasks'" class="tasks-list-view">
                <!-- 任务列表 -->
                <div class="content-section tasks-section">
                  <div class="section-header">
                    <h4 class="section-title"><Icon name="clipboard-list" :size="18" /> 学习任务列表</h4>
                  </div>
                  <div class="section-content">
                    <div class="tasks-list">
                      <div 
                        v-for="(task, index) in selectedPlan.tasks" 
                        :key="task.id"
                        class="task-item"
                        :class="{ completed: task.is_completed, active: isTaskActive(task) }"
                      >
                        <div class="task-number">{{ index + 1 }}</div>
                        <div class="task-main-content">
                          <div class="task-header-row">
                            <h4>{{ task.name }}</h4>
                            <div class="task-status-badge" :class="getTaskStatusClass(task)">
                              {{ getTaskStatusText(task) }}
                        </div>
                        </div>
                          <p class="task-desc">{{ task.description }}</p>
                          
                          <!-- 复习内容 -->
                          <div v-if="task.review_content" class="task-review">
                            <div class="review-label">
                              <Icon name="book-open" :size="16" /> 复习内容
                        </div>
                            <div class="review-content">{{ task.review_content }}</div>
                            <div v-if="task.review_video_url" class="review-video">
                              <a :href="task.review_video_url" target="_blank" class="video-link">
                                <Icon name="play" :size="16" /> 观看复习视频
                              </a>
                      </div>
                    </div>

                          <div class="task-time">
                            <Icon name="clock" :size="16" />
                            {{ formatDateTime(task.start_time) }} - {{ formatDateTime(task.end_time) }}
                </div>

                          <!-- 练习统计 -->
                          <div class="task-exercises-stats">
                            <div class="exercise-stat">
                              <Icon name="file-text" :size="16" />
                              客观题: {{ task.exam_count || 0 }}套
                  </div>
                            <div class="exercise-stat">
                              <Icon name="code" :size="16" />
                              OJ题: {{ task.oj_count || 0 }}道
                        </div>
                        </div>

                        <div class="task-actions">
                          <button 
                              class="task-action-btn start-btn" 
                              @click.stop="enterTask(task)"
                              :disabled="!isTaskActive(task)"
                            >
                              <Icon name="play" :size="16" /> 开始任务
                          </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 计划信息卡片 -->
                <div class="content-section plan-info-card">
                  <div class="section-content">
                    <div class="plan-info-header">
                      <h2>{{ selectedPlan.name }}</h2>
                      <div class="plan-level-badge-large">GESP {{ selectedPlan.level }}级</div>
                  </div>
                    <p class="plan-info-desc">{{ selectedPlan.description }}</p>
                    <div class="plan-info-stats">
                      <div class="info-stat">
                        <span class="stat-value">{{ selectedPlan.completed_tasks }}</span>
                        <span class="stat-label">已完成</span>
                        </div>
                      <div class="info-stat">
                        <span class="stat-value">{{ selectedPlan.total_tasks }}</span>
                        <span class="stat-label">总任务</span>
                        </div>
                      <div class="info-stat">
                        <span class="stat-value">{{ selectedPlan.progress }}%</span>
                        <span class="stat-label">完成率</span>
                      </div>
                    </div>
                  </div>
                </div>
                </div>

                <!-- 视图3: 任务的练习列表 -->
                <div v-if="sidebarView === 'my-plans' && currentView === 'exercises'" class="exercises-list-view">
                <!-- 任务信息卡片 -->
                <div class="content-section task-info-card">
                  <div class="section-content">
                    <h2>{{ selectedTask.name }}</h2>
                    <p class="task-info-desc">{{ selectedTask.description }}</p>
                    
                    <!-- 复习内容展示 -->
                    <div v-if="selectedTask.review_content" class="review-section">
                      <h4><Icon name="book-open" :size="18" /> 复习内容</h4>
                      <div class="review-content-box">{{ selectedTask.review_content }}</div>
                      <a v-if="selectedTask.review_video_url" :href="selectedTask.review_video_url" target="_blank" class="video-link-large">
                        <Icon name="play" :size="18" /> 观看复习视频
                      </a>
                      </div>
                          </div>
                </div>

                <!-- 客观题练习列表 -->
                <div v-if="selectedTask.exams && selectedTask.exams.length > 0" class="content-section">
                  <div class="section-header">
                    <h4 class="section-title"><Icon name="file-text" :size="18" /> 客观题练习</h4>
                  </div>
                  <div class="section-content">
                    <div class="exercises-grid">
                      <div 
                        v-for="exam in selectedTask.exams" 
                        :key="exam.id"
                        class="exercise-card"
                        @click="startExam(exam)"
                      >
                        <div class="exercise-icon"><Icon name="file-text" :size="40" /></div>
                        <h4>{{ exam.name }}</h4>
                        <p class="exercise-desc">{{ exam.description }}</p>
                        <div class="exercise-info">
                            </div>
                        <div class="exercise-status" :class="getExerciseStatusClass(exam)">
                          {{ getExerciseStatusText(exam) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- OJ题目列表 -->
                <div v-if="selectedTask.oj_problems && selectedTask.oj_problems.length > 0" class="content-section">
                  <div class="section-header">
                    <h4 class="section-title"><Icon name="code" :size="18" /> OJ编程题</h4>
                  </div>
                  <div class="section-content">
                    <div class="exercises-grid">
                      <div 
                        v-for="problem in selectedTask.oj_problems" 
                        :key="problem.id"
                        class="exercise-card"
                        @click="startOJ(problem)"
                      >
                        <div class="exercise-icon"><Icon name="code" :size="40" /></div>
                        <h4>{{ problem.title }}</h4>
                        <div class="exercise-info">
                          <span class="difficulty-badge" :class="'difficulty-' + problem.difficulty">
                            {{ getDifficultyText(problem.difficulty) }}
                          </span>
                    </div>
                        <div class="exercise-status" :class="getExerciseStatusClass(problem)">
                          {{ getExerciseStatusText(problem) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

              <!-- 学习总结（费恩曼学习法）入口 -->
              <div class="content-section" v-if="currentView === 'exercises'">
                <div class="section-header">
                  <h4 class="section-title"><Icon name="video" :size="18" /> 学习总结（费恩曼学习法）</h4>
                </div>
                <div class="section-content">
                  <p class="feynman-intro">使用费恩曼学习法录制你的任务总结，巩固理解、发现盲点、提升表达能力。</p>
                  <button class="enter-plan-btn" @click="goFeynmanSummary">
                    进入学习总结页面 <Icon name="arrow-right" :size="16" />
                  </button>
                </div>
              </div>
              </div>
        </div>

            </div>
          </div>
        </div>
      </div>

      <!-- 右侧占位区域 -->
      <div class="sidebar-placeholder-right"></div>
    </div>

    <!-- 右侧固定边栏：我的计划 → 我的测试 → 计划排名 → 我的提交 → 倒计时（最底） -->
    <div class="sidebar-right-fixed">
      <div class="sidebar-nav">
        <button 
          class="sidebar-nav-item sidebar-nav-item-my-plans" 
          :class="{ active: sidebarView === 'my-plans' }"
          @click="router.push('/plan')"
        >
          <Icon name="book-open" :size="32" />
          <span>我的计划</span>
        </button>
        <button 
          class="sidebar-nav-item sidebar-nav-item-tests" 
          :class="{ active: sidebarView === 'my-tests' }"
          @click="router.push('/plan/tests')"
        >
          <Icon name="clipboard-list" :size="32" />
          <span>我的测试</span>
          <span class="sidebar-nav-new-badge">上新</span>
        </button>
        <button 
          class="sidebar-nav-item sidebar-nav-item-ranking" 
          :class="{ active: sidebarView === 'global-ranking' }"
          @click="router.push('/plan/ranking')"
        >
          <Icon name="trophy" :size="32" />
          <span>计划排名</span>
        </button>
        <button 
          class="sidebar-nav-item sidebar-nav-item-submissions" 
          :class="{ active: sidebarView === 'my-submissions' }"
          @click="router.push('/plan/submissions')"
        >
          <Icon name="file-text" :size="32" />
          <span>我的提交</span>
          <span class="sidebar-nav-new-badge">上新</span>
        </button>
        <button 
          v-if="isTeacherOrAdmin"
          class="sidebar-nav-item sidebar-nav-item-submissions" 
          :class="{ active: sidebarView === 'student-submissions' }"
          @click="router.push({ path: '/plan/submissions', query: { view: 'students' } })"
        >
          <Icon name="users" :size="32" />
          <span>学生提交</span>
        </button>
      </div>
    </div>

    <!-- 排名弹窗 -->
    <div v-if="showRankingDialog" class="modal-overlay" @click="showRankingDialog = false">
      <div class="modal-content ranking-modal" @click.stop>
        <div class="modal-header ranking-modal-header">
          <div class="modal-header-left">
            <h3>{{ isGlobalRanking ? '计划排名' : '班级排名' }}</h3>
            <!-- 老师信息（仅班级排名显示） -->
            <div v-if="rankingData && !isGlobalRanking && rankingData.teacher" class="ranking-teacher-info-header">
              <Icon name="user" :size="14" />
              <span>指导老师: {{ rankingData.teacher.real_name || rankingData.teacher.username }}</span>
            </div>
          </div>
          <div class="modal-header-center">
            <!-- 计划信息 -->
            <div v-if="rankingData" class="ranking-plan-info-header">
              <h4>{{ rankingData.plan?.name }}</h4>
              <p>GESP {{ rankingData.plan?.level }}级</p>
            </div>
          </div>
          <div class="modal-header-right">
            <!-- 当前学生排名（仅在用户在计划中且有排名信息时显示） -->
            <div v-if="rankingData && rankingData.current_student && (rankingData.current_student.rank || rankingData.current_student.display_rank)" class="current-student-ranking-header">
              <div class="current-rank-badge-header" :class="getRankingClass(rankingData.current_student.display_rank || rankingData.current_student.rank)">
                <Icon name="award" :size="18" />
                <div class="rank-info">
                  <div class="rank-number">第{{ rankingData.current_student.display_rank || rankingData.current_student.rank }}名</div>
                  <div class="rank-total">共{{ rankingData.current_student.total_students }}人</div>
                </div>
              </div>
            </div>
            <!-- 如果用户不在计划中，显示提示信息 -->
            <div v-else-if="rankingData && isGlobalRanking && !rankingData.current_student" class="current-student-ranking-header not-in-plan-header">
              <div class="not-in-plan-notice-header">
                <Icon name="info" :size="14" />
                <span>您尚未加入此计划</span>
              </div>
            </div>
            <button class="modal-close-btn" @click="showRankingDialog = false">
              <Icon name="x" :size="28" />
            </button>
          </div>
        </div>
        <div class="modal-body" :class="{ 'modal-body-loading': rankingLoading }">
          <!-- 加载状态 -->
          <div v-if="rankingLoading" class="ranking-loading">
            <div class="loading-animation-container">
              <div class="loading-trophy">
                <Icon name="trophy" :size="60" />
              </div>
              <div class="loading-dots">
                <span class="dot dot-1"></span>
                <span class="dot dot-2"></span>
                <span class="dot dot-3"></span>
              </div>
            </div>
            <p class="loading-text">加载排名数据中<span class="loading-ellipsis"><span class="ellipsis-dot">.</span><span class="ellipsis-dot">.</span><span class="ellipsis-dot">.</span></span></p>
          </div>
          
          <!-- 排名内容 -->
          <div v-else-if="rankingData" class="ranking-content">
            
            <!-- 排名列表 -->
            <div class="ranking-list">
              <div class="ranking-list-header">
                <h4>完整排名</h4>
                <div class="ranking-header-controls">
                  <!-- 教师过滤选项 -->
                  <div v-if="isTeacherOrAdmin" class="teacher-filter-toggle">
                    <label class="filter-toggle-label">
                      <input 
                        type="checkbox" 
                        v-model="showOnlyMyStudents"
                        class="filter-checkbox"
                      />
                      <Icon name="users" :size="18" />
                      <span>只看我的学生</span>
                    </label>
                  </div>
                  <!-- 搜索框 -->
                  <div class="ranking-search-box">
                    <Icon name="search" :size="18" />
                    <input 
                      type="text" 
                      v-model="rankingSearchKeyword"
                      placeholder="搜索学生姓名..."
                      class="ranking-search-input"
                    />
                    <button 
                      v-if="rankingSearchKeyword" 
                      @click="rankingSearchKeyword = ''"
                      class="ranking-search-clear"
                    >
                      <Icon name="x" :size="16" />
                    </button>
                  </div>
                </div>
              </div>
              <div class="ranking-table">
                <div class="ranking-table-header">
                  <div class="rank-col">排名</div>
                  <div class="name-col">姓名</div>
                  <div class="teacher-col">指导教师</div>
                  <div class="progress-col">完成进度</div>
                  <div class="status-col">状态</div>
                </div>
                <div 
                  v-for="(student, index) in filteredRankingStudents" 
                  :key="student.student_id"
                  class="ranking-table-row"
                  :class="{ 
                    'is-current': rankingData.current_student && student.student_id === rankingData.current_student.student_id,
                    'top-three': (student.display_rank || student.rank) <= 3
                  }"
                >
                  <div class="rank-col">
                    <div class="rank-number-display" :class="getRankingClass(student.display_rank || student.rank)">
                      <span v-if="(student.display_rank || student.rank) <= 3" class="medal-icon">
                        <Icon :name="(student.display_rank || student.rank) === 1 ? 'medal' : (student.display_rank || student.rank) === 2 ? 'medal' : 'medal'" :size="20" />
                      </span>
                      <span v-else>{{ student.display_rank || student.rank }}</span>
                    </div>
                  </div>
                  <div class="name-col">
                    <span class="student-name">{{ student.real_name || student.username }}</span>
                    <span v-if="rankingData.current_student && student.student_id === rankingData.current_student.student_id" class="current-badge">我</span>
                  </div>
                  <div class="teacher-col">
                    <span class="teacher-name">{{ formatTeachers(student.teachers) }}</span>
                  </div>
                  <div class="progress-col">
                    <div v-if="student.plan_progress" class="student-progress">
                      <div class="progress-info">
                        <span class="progress-main">
                          任务: {{ formatTaskCompleted(student.plan_progress) }}/{{ student.plan_progress.total_tasks }}
                        </span>
                        <span class="progress-percent">{{ student.plan_progress.progress_rate }}%</span>
                      </div>
                      <div class="progress-details">
                        <span class="progress-detail-item">
                          客观题: {{ student.plan_progress.completed_exams || 0 }}/{{ student.plan_progress.total_exams || 0 }}
                        </span>
                        <span class="progress-detail-item">
                          OJ题: {{ student.plan_progress.completed_ojs || 0 }}/{{ student.plan_progress.total_ojs || 0 }}
                        </span>
                      </div>
                      <div class="progress-bar-mini">
                        <div 
                          class="progress-bar-fill-mini" 
                          :style="{ width: student.plan_progress.progress_rate + '%' }"
                        ></div>
                      </div>
                    </div>
                    <span v-else class="no-progress">暂无数据</span>
                  </div>
                  <div class="status-col">
                    <span 
                      v-if="student.plan_progress?.is_completed" 
                      class="status-badge completed"
                    >
                      <Icon name="check-circle" :size="14" /> 已完成
                    </span>
                    <span v-else class="status-badge in-progress">
                      <Icon name="clock" :size="14" /> 进行中
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 错误状态 -->
          <div v-else-if="rankingError" class="ranking-error">
            <Icon name="alert-triangle" :size="40" />
            <p>{{ rankingError }}</p>
            <button class="retry-btn" @click="loadRankingData(selectedRankingPlan?.id)">
              <Icon name="refresh-cw" :size="16" /> 重试
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 加入计划弹窗 -->
    <div v-if="showJoinDialog" class="modal-overlay" @click="showJoinDialog = false">
      <div class="modal-content join-plan-modal" @click.stop>
        <div class="modal-header">
          <h3>加入学习计划</h3>
          <button class="modal-close-btn" @click="showJoinDialog = false">
            <Icon name="x" :size="18" />
          </button>
          </div>
        <div class="modal-body">
          <!-- 级别选择 -->
          <div class="level-selector">
            <div class="level-label">选择GESP级别:</div>
            <div class="level-buttons">
              <button 
                v-for="level in [1, 2, 3, 4, 5, 6, 7, 8]" 
                :key="level"
                class="level-btn"
                :class="{ active: joinDialogLevel === level }"
                @click="joinDialogLevel = level"
              >
                {{ level }}级
              </button>
        </div>
      </div>

          <!-- 可用计划列表 -->
          <div class="available-plans">
            <div 
              v-for="plan in allAvailablePlans" 
              :key="plan.id"
              class="plan-option"
              :class="{ selected: selectedJoinPlan?.id === plan.id }"
              @click="selectedJoinPlan = plan"
            >
              <div class="plan-option-header">
                <h4>{{ plan.name }}</h4>
                <div class="plan-level-tag">{{ plan.level }}级</div>
              </div>
              <p>{{ plan.description }}</p>
              <div class="plan-meta">
                <span><Icon name="calendar" :size="16" /> {{ formatDate(plan.start_time) }} - {{ formatDate(plan.end_time) }}</span>
                <span><Icon name="check-square" :size="16" /> {{ plan.total_tasks }}个任务</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showJoinDialog = false">取消</button>
          <button 
            class="btn-confirm" 
            :disabled="!selectedJoinPlan"
            @click="confirmJoinPlan"
          >
            加入计划
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import MySubmissionsSection from '@/components/plan/MySubmissionsSection.vue'

const router = useRouter()
const route = useRoute()

import { BASE_URL } from '@/config/api'

// 根据路由 path 与 query 得到右侧栏视图（学生提交仅教师可见）
function planSectionFromPath (path: string, queryView?: string, teacherOrAdmin?: boolean): 'my-plans' | 'global-ranking' | 'my-submissions' | 'my-tests' | 'student-submissions' {
  if (path === '/plan/ranking') return 'global-ranking'
  if (path === '/plan/tests') return 'my-tests'
  if (path === '/plan/submissions') {
    if (queryView === 'students' && teacherOrAdmin) return 'student-submissions'
    return 'my-submissions'
  }
  return 'my-plans'
}

// 用户信息（sidebarView 依赖 isTeacherOrAdmin，isTeacherOrAdmin 依赖 userInfo，故 userInfo 与 isTeacherOrAdmin 需在 sidebarView 前定义）
const userInfo = ref<any>(null)
const isTeacherOrAdmin = computed(() => {
  if (!userInfo.value) return false
  return userInfo.value.role_names?.includes('teacher') ||
         userInfo.value.role_names?.includes('admin') ||
         userInfo.value.roles?.some((role: any) => role.name === 'teacher' || role.name === 'admin')
})

const sidebarView = computed(() => planSectionFromPath(route.path, route.query.view as string | undefined, isTeacherOrAdmin.value))

// 当前视图: 'plans' | 'tasks' | 'exercises'
const currentView = ref('plans')
const selectedLevel = ref<number | null>(null)
const selectedPlan = ref<any>(null)
const selectedTask = ref<any>(null)

// 加入计划弹窗
const showJoinDialog = ref(false)
const joinDialogLevel = ref(1)
const selectedJoinPlan = ref<any>(null)

// 排名弹窗
const showRankingDialog = ref(false)
const rankingData = ref<any>(null)
const rankingLoading = ref(false)
const rankingError = ref<string | null>(null)
const selectedRankingPlan = ref<any>(null)
const isGlobalRanking = ref(false) // 是否是全球排名
const rankingSearchKeyword = ref('') // 排名搜索关键词
const showOnlyMyStudents = ref(false) // 是否只显示我的学生（教师功能）
const myStudentIds = ref<number[]>([]) // 当前教师的学生ID列表

// 计划排名相关
const allPlansForRanking = ref<any[]>([])
const globalRankingLoading = ref(false)
const globalRankingError = ref<string | null>(null)
const planRankingsCache = ref<Map<number, any>>(new Map()) // 缓存计划的排名信息

// 加载状态
const loading = ref(false)
const error = ref<string | null>(null)

// 我的学习计划列表
const myPlans = ref<any[]>([])

// 我的测试列表
const testsList = ref<any[]>([])
const testsLoading = ref(false)

// 所有可用计划（用于加入计划弹窗）
const allAvailablePlans = ref<any[]>([])

// API调用方法
const fetchMyPlans = async () => {
  if (!userInfo.value?.id) return
  
  loading.value = true
  error.value = null
  
  try {
    const response = await fetch(`${BASE_URL}/learning-plans/my-plans?user_id=${userInfo.value.id}`)
    if (!response.ok) {
      throw new Error(`获取我的计划失败: ${response.status}`)
    }
    const result = await response.json()
    if (result.success) {
      myPlans.value = result.data || []
    } else {
      throw new Error(result.message || '获取我的计划失败')
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取我的计划失败'
    console.error('获取我的计划失败:', err)
  } finally {
    loading.value = false
  }
}

const fetchAvailablePlans = async (level: number) => {
  if (!userInfo.value?.id) return []
  
  try {
    const response = await fetch(`${BASE_URL}/learning-plans/available?user_id=${userInfo.value.id}&level=${level}`)
    if (!response.ok) {
      throw new Error(`获取可用计划失败: ${response.status}`)
    }
    const result = await response.json()
    if (result.success) {
      return result.data || []
    } else {
      throw new Error(result.message || '获取可用计划失败')
    }
  } catch (err) {
    console.error('获取可用计划失败:', err)
    return []
  }
}

const joinPlan = async (planId: number) => {
  if (!userInfo.value?.id) return false
  
  try {
    const response = await fetch(`${BASE_URL}/learning-plans/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userInfo.value.id,
        plan_id: planId
      })
    })
    
    if (!response.ok) {
      throw new Error(`加入计划失败: ${response.status}`)
    }
    
    const result = await response.json()
    if (result.success) {
      return true
    } else {
      throw new Error(result.message || '加入计划失败')
    }
  } catch (err) {
    console.error('加入计划失败:', err)
    error.value = err instanceof Error ? err.message : '加入计划失败'
    return false
  }
}

const fetchPlanTasks = async (planId: number) => {
  if (!userInfo.value?.id) return null
  
  try {
    const response = await fetch(`${BASE_URL}/learning-plans/${planId}/tasks?user_id=${userInfo.value.id}`)
    if (!response.ok) {
      throw new Error(`获取计划任务失败: ${response.status}`)
    }
    const result = await response.json()
    if (result.success) {
      return result.data
    } else {
      throw new Error(result.message || '获取计划任务失败')
    }
  } catch (err) {
    console.error('获取计划任务失败:', err)
    error.value = err instanceof Error ? err.message : '获取计划任务失败'
    return null
  }
}

const fetchPlanProgress = async (planId: number) => {
  if (!userInfo.value?.id) return null
  
  try {
    const response = await fetch(`${BASE_URL}/learning-plans/${planId}/progress?user_id=${userInfo.value.id}`)
    if (!response.ok) {
      throw new Error(`获取计划进度失败: ${response.status}`)
    }
    const result = await response.json()
    if (result.success) {
      return result.data
    } else {
      throw new Error(result.message || '获取计划进度失败')
    }
  } catch (err) {
    console.error('获取计划进度失败:', err)
    return null
  }
}

const fetchTaskExercises = async (taskId: number) => {
  if (!userInfo.value?.id) return null
  
  try {
    const response = await fetch(`${BASE_URL}/learning-tasks/${taskId}/exercises?user_id=${userInfo.value.id}`)
    if (!response.ok) {
      throw new Error(`获取任务练习失败: ${response.status}`)
    }
    const result = await response.json()
    if (result.success) {
      return result.data
    } else {
      throw new Error(result.message || '获取任务练习失败')
    }
  } catch (err) {
    console.error('获取任务练习失败:', err)
    error.value = err instanceof Error ? err.message : '获取任务练习失败'
    return null
  }
}

const completeTask = async (taskId: number) => {
  if (!userInfo.value?.id) return false
  
  try {
    const response = await fetch(`${BASE_URL}/learning-tasks/${taskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userInfo.value.id
      })
    })
    
    if (!response.ok) {
      throw new Error(`标记任务完成失败: ${response.status}`)
    }
    
    const result = await response.json()
    if (result.success) {
      return true
    } else {
      throw new Error(result.message || '标记任务完成失败')
    }
  } catch (err) {
    console.error('标记任务完成失败:', err)
    error.value = err instanceof Error ? err.message : '标记任务完成失败'
    return false
  }
}

const fetchClassRanking = async (planId: number) => {
  if (!userInfo.value?.id) return null
  
  try {
    const response = await fetch(`${BASE_URL}/learning-plans/${planId}/class-ranking?user_id=${userInfo.value.id}`)
    if (!response.ok) {
      throw new Error(`获取排名失败: ${response.status}`)
    }
    const result = await response.json()
    if (result.success) {
      return result.data
    } else {
      throw new Error(result.message || '获取排名失败')
    }
  } catch (err) {
    console.error('获取排名失败:', err)
    rankingError.value = err instanceof Error ? err.message : '获取排名失败'
    return null
  }
}

const fetchGlobalRanking = async (planId: number) => {
  if (!userInfo.value?.id) return null
  
  try {
    const response = await fetch(`${BASE_URL}/learning-plans/${planId}/global-ranking?user_id=${userInfo.value.id}`)
    if (!response.ok) {
      throw new Error(`获取计划排名失败: ${response.status}`)
    }
    const result = await response.json()
    if (result.success) {
      return result.data
    } else {
      throw new Error(result.message || '获取计划排名失败')
    }
  } catch (err) {
    console.error('获取计划排名失败:', err)
    rankingError.value = err instanceof Error ? err.message : '获取计划排名失败'
    return null
  }
}

const fetchAllPlans = async () => {
  if (!userInfo.value?.id) return
  
  globalRankingLoading.value = true
  globalRankingError.value = null
  
  try {
    // 获取所有计划（包括用户已加入和未加入的）
    const allPlansMap = new Map<number, any>()
    
    // 1. 先获取用户已加入的计划
    if (myPlans.value && myPlans.value.length > 0) {
      myPlans.value.forEach((plan: any) => {
        allPlansMap.set(plan.id, plan)
      })
    }
    
    // 2. 并行获取所有级别的所有计划（使用 all API 而不是 available API）
    // 优化：改为并行请求，减少总等待时间
    const levelPromises = [1, 2, 3, 4, 5, 6, 7, 8].map(async (level) => {
      try {
        const response = await fetch(`${BASE_URL}/learning-plans/all?level=${level}&is_active=1`)
        if (!response.ok) {
          console.warn(`获取${level}级计划失败: ${response.status}`)
          return []
        }
        const result = await response.json()
        if (result.success && result.data) {
          return result.data || []
        }
        return []
      } catch (err) {
        console.error(`获取${level}级计划失败:`, err)
        return []
      }
    })
    
    // 等待所有级别的计划获取完成
    const allLevelPlans = await Promise.all(levelPromises)
    
    // 合并所有级别的计划
    allLevelPlans.flat().forEach((plan: any) => {
      // 如果计划不存在，或者已加入的计划数据更完整，则添加/更新
      if (!allPlansMap.has(plan.id)) {
        allPlansMap.set(plan.id, plan)
      } else {
        // 如果已存在，优先使用已加入计划的数据（可能包含更多信息）
        const existingPlan = allPlansMap.get(plan.id)
        // 保留已加入计划的额外字段（如 progress, completed_tasks 等）
        allPlansMap.set(plan.id, {
          ...plan,
          ...existingPlan,
          // 如果已加入计划有进度信息，优先使用
          progress: existingPlan.progress ?? plan.progress,
          completed_tasks: existingPlan.completed_tasks ?? plan.completed_tasks,
          total_tasks: existingPlan.total_tasks ?? plan.total_tasks
        })
      }
    })
    
    // 转换为数组并按创建时间倒序排列
    const allPlansArray = Array.from(allPlansMap.values())
    allPlansArray.sort((a: any, b: any) => {
      // 优先显示用户已加入的计划
      const aJoined = myPlans.value?.some((p: any) => p.id === a.id) ? 1 : 0
      const bJoined = myPlans.value?.some((p: any) => p.id === b.id) ? 1 : 0
      if (aJoined !== bJoined) return bJoined - aJoined
      
      // 然后按创建时间倒序
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })
    
    // 优化：不在这里加载排名信息，延迟到弹窗打开时才加载
    // 这样列表页可以快速显示，提升用户体验
    
    allPlansForRanking.value = allPlansArray
  } catch (err) {
    globalRankingError.value = err instanceof Error ? err.message : '获取计划列表失败'
    console.error('获取计划列表失败:', err)
  } finally {
    globalRankingLoading.value = false
  }
}

// 根据进度重新计算排名，相同进度的学生显示相同排名
const recalculateRanking = (data: any) => {
  if (!data || !data.students) return data
  
  // 复制学生数组
  const students = [...data.students]
  
  // 排序：已完成优先，然后按进度排序
  students.sort((a, b) => {
    const aProgress = a.plan_progress
    const bProgress = b.plan_progress
    
    // 如果都没有进度数据，保持原顺序
    if (!aProgress && !bProgress) return 0
    if (!aProgress) return 1
    if (!bProgress) return -1
    
    // 已完成的学生优先
    if (aProgress.is_completed && !bProgress.is_completed) return -1
    if (!aProgress.is_completed && bProgress.is_completed) return 1
    
    // 如果都已完成，按完成时间排序（早完成的排名靠前）
    if (aProgress.is_completed && bProgress.is_completed) {
      const aTime = aProgress.completed_at ? new Date(aProgress.completed_at).getTime() : 0
      const bTime = bProgress.completed_at ? new Date(bProgress.completed_at).getTime() : 0
      return aTime - bTime
    }
    
    // 都未完成，按进度排序
    // 先按已完成任务数（优先使用精确值）
    const aTasks = aProgress.completed_tasks_precise !== undefined ? aProgress.completed_tasks_precise : aProgress.completed_tasks
    const bTasks = bProgress.completed_tasks_precise !== undefined ? bProgress.completed_tasks_precise : bProgress.completed_tasks
    if (aTasks !== bTasks) {
      return bTasks - aTasks
    }
    
    // 已完成任务数相同，按进度百分比
    return bProgress.progress_rate - aProgress.progress_rate
  })
  
  // 重新计算排名：相同进度的学生显示相同排名
  let currentRank = 1
  let prevProgressKey: string | null = null
  
  students.forEach((student, index) => {
    const progress = student.plan_progress
    
    if (!progress) {
      // 没有进度数据的学生排在最后，都显示相同排名
      if (prevProgressKey !== 'no-progress') {
        currentRank = index + 1
        prevProgressKey = 'no-progress'
      }
      student.display_rank = currentRank
      return
    }
    
    // 生成进度唯一标识：用于判断是否相同进度
    // 对于已完成：使用 is_completed + completed_tasks_precise/completed_tasks + total_tasks
    // 对于未完成：使用 completed_tasks_precise/completed_tasks + total_tasks + progress_rate
    let progressKey: string
    const tasksValue = progress.completed_tasks_precise !== undefined ? progress.completed_tasks_precise : progress.completed_tasks
    if (progress.is_completed) {
      // 已完成的学生：只要完成的任务数相同，就视为相同排名
      progressKey = `completed-${tasksValue}-${progress.total_tasks}`
    } else {
      // 未完成的学生：已完成任务数和进度百分比都相同，才视为相同排名
      progressKey = `inprogress-${tasksValue}-${progress.total_tasks}-${progress.progress_rate}`
    }
    
    // 判断是否与上一个学生进度相同
    if (prevProgressKey !== null && prevProgressKey !== progressKey) {
      // 进度不同，排名递增
      currentRank = index + 1
    }
    // 进度相同，保持当前排名
    
    student.display_rank = currentRank
    prevProgressKey = progressKey
  })
  
  // 更新当前学生的排名
  if (data.current_student) {
    const currentStudent = students.find((s: any) => s.student_id === data.current_student.student_id)
    if (currentStudent) {
      data.current_student.display_rank = currentStudent.display_rank
      data.current_student.total_students = students.length
    }
  }
  
  // 更新数据
  data.students = students
  
  return data
}

const loadRankingData = async (planId: number) => {
  rankingLoading.value = true
  rankingError.value = null
  rankingData.value = null
  
  const data = await fetchClassRanking(planId)
  if (data) {
    // 重新计算排名
    rankingData.value = recalculateRanking(data)
  }
  
  rankingLoading.value = false
}

const showRanking = async (plan: any) => {
  selectedRankingPlan.value = plan
  rankingSearchKeyword.value = '' // 清空搜索关键词
  showOnlyMyStudents.value = false // 重置过滤选项
  showRankingDialog.value = true
  isGlobalRanking.value = false
  // 如果是教师用户，获取学生列表
  if (isTeacherOrAdmin.value) {
    await fetchMyStudents()
  }
  await loadRankingData(plan.id)
}

const showGlobalRanking = async (plan: any) => {
  selectedRankingPlan.value = plan
  rankingSearchKeyword.value = '' // 清空搜索关键词
  showOnlyMyStudents.value = false // 重置过滤选项
  showRankingDialog.value = true
  isGlobalRanking.value = true
  // 如果是教师用户，获取学生列表
  if (isTeacherOrAdmin.value) {
    await fetchMyStudents()
  }
  await loadGlobalRankingData(plan.id)
}

const loadGlobalRankingData = async (planId: number) => {
  rankingLoading.value = true
  rankingError.value = null
  rankingData.value = null
  
  const data = await fetchGlobalRanking(planId)
  if (data) {
    // 重新计算排名（使用相同的排名算法）
    rankingData.value = recalculateRanking(data)
    
    // 缓存当前用户的排名信息，以便在列表页显示
    if (rankingData.value.current_student) {
      const currentStudent = rankingData.value.current_student
      planRankingsCache.value.set(planId, {
        rank: currentStudent.display_rank || currentStudent.rank,
        total_students: currentStudent.total_students || rankingData.value.students?.length || 0
      })
      
      // 更新列表中的计划对象，以便实时显示排名
      const plan = allPlansForRanking.value.find(p => p.id === planId)
      if (plan) {
        plan.my_rank = currentStudent.display_rank || currentStudent.rank
        plan.total_students = currentStudent.total_students || rankingData.value.students?.length || 0
      }
    }
  }
  
  rankingLoading.value = false
}

const getRankingClass = (rank: number) => {
  if (rank === 1) return 'rank-first'
  if (rank === 2) return 'rank-second'
  if (rank === 3) return 'rank-third'
  if (rank <= 10) return 'rank-top-ten'
  return 'rank-normal'
}

const getRankingBadgeClass = (rank: number) => {
  if (rank === 1) return 'rank-badge-first'
  if (rank === 2) return 'rank-badge-second'
  if (rank === 3) return 'rank-badge-third'
  if (rank <= 10) return 'rank-badge-top-ten'
  return 'rank-badge-normal'
}

// 获取教师的学生列表
const fetchMyStudents = async () => {
  if (!userInfo.value?.id || !isTeacherOrAdmin.value) return
  
  try {
    // API路径：/api/teacher/:teacherId/students
    const response = await fetch(`${BASE_URL}/teacher/${userInfo.value.id}/students`)
    if (!response.ok) {
      console.warn('获取我的学生列表失败:', response.status)
      return
    }
    const students = await response.json()
    if (Array.isArray(students)) {
      myStudentIds.value = students.map((s: any) => s.id)
      console.log('已获取学生列表，共', myStudentIds.value.length, '名学生')
    }
  } catch (err) {
    console.error('获取我的学生列表失败:', err)
  }
}

// 过滤排名学生列表
const filteredRankingStudents = computed(() => {
  if (!rankingData.value || !rankingData.value.students) return []
  
  let students = rankingData.value.students
  
  // 如果启用"只查看我的学生"且是教师用户，过滤学生列表
  if (showOnlyMyStudents.value && isTeacherOrAdmin.value) {
    if (myStudentIds.value.length > 0) {
      const beforeFilter = students.length
      students = students.filter((student: any) => {
        // 尝试多种可能的ID字段名（兼容不同的数据结构）
        const studentId = student.student_id || student.id || student.user_id
        return myStudentIds.value.includes(studentId)
      })
      console.log(`教师过滤: ${beforeFilter} -> ${students.length} 名学生`)
    } else {
      console.warn('我的学生ID列表为空，请先获取学生列表')
    }
  }
  
  // 如果有关键词，进行搜索过滤
  if (rankingSearchKeyword.value.trim()) {
    const keyword = rankingSearchKeyword.value.trim().toLowerCase()
    students = students.filter((student: any) => {
      const realName = (student.real_name || '').toLowerCase()
      const username = (student.username || '').toLowerCase()
      return realName.includes(keyword) || username.includes(keyword)
    })
  }
  
  return students
})

// 工具方法
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// 格式化任务完成数：如果是整数则显示整数，否则保留2位小数
const formatTaskCompleted = (progress: any) => {
  if (progress.completed_tasks_precise !== undefined) {
    const value = progress.completed_tasks_precise
    // 判断是否为整数
    if (Number.isInteger(value)) {
      return value.toString()
    }
    return value.toFixed(2)
  }
  return progress.completed_tasks?.toString() || '0'
}

const formatDateTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getPlanStatusClass = (plan: any) => {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  
  if (now < start) return 'status-upcoming'
  if (now > end) return 'status-ended'
  return 'status-active'
}

const getPlanStatusText = (plan: any) => {
  const now = new Date()
  const start = new Date(plan.start_time)
  const end = new Date(plan.end_time)
  
  if (now < start) return '未开始'
  if (now > end) return '已结束'
  return '进行中'
}

const getTaskStatusClass = (task: any) => {
  if (task.is_completed) return 'status-completed'
  
  const now = new Date()
  const start = new Date(task.start_time)
  const end = new Date(task.end_time)
  
  if (now < start) return 'status-upcoming'
  if (now > end) return 'status-overdue'
  return 'status-active'
}

const getTaskStatusText = (task: any) => {
  if (task.is_completed) return '已完成'
  
  const now = new Date()
  const start = new Date(task.start_time)
  const end = new Date(task.end_time)
  
  if (now < start) return '未开始'
  if (now > end) return '已过期'
  return '进行中'
}

const isTaskActive = (task: any) => {
  if (task.is_completed) return true
  
  const now = new Date()
  const start = new Date(task.start_time)
  const end = new Date(task.end_time)
  
  return now >= start && now <= end
}

const getExerciseStatusClass = (exercise: any) => {
  return exercise.is_completed === true || exercise.is_completed === 1 || exercise.is_completed === '1' ? 'status-completed' : 'status-pending'
}

const getExerciseStatusText = (exercise: any) => {
  return exercise.is_completed === true || exercise.is_completed === 1 || exercise.is_completed === '1' ? '已完成' : '未完成'
}

const getDifficultyText = (difficulty: string) => {
  const map: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  }
  return map[difficulty] || difficulty
}

// 格式化教师信息显示
const formatTeachers = (teachers: any[] | undefined) => {
  if (!teachers || teachers.length === 0) {
    return '暂无'
  }
  // 显示所有教师的姓名，用逗号分隔
  return teachers.map((teacher: any) => teacher.real_name || teacher.username).join('、')
}

// 跳转到学习总结页面
const goFeynmanSummary = () => {
  const plan = selectedPlan.value?.id
  const task = selectedTask.value?.id
  const level = selectedPlan.value?.level
  const url = `/feynman-summary?planId=${plan ?? ''}&taskId=${task ?? ''}&level=${level ?? ''}`
  router.push(url)
}

// 进入计划查看任务
const enterPlan = async (plan: any) => {
  // 跳转到任务列表页面
  router.push(`/plan/${plan.id}/tasks`)
}

// 返回计划列表
const backToPlans = () => {
  currentView.value = 'plans'
  selectedPlan.value = null
  selectedLevel.value = null
}

// 进入任务查看练习
const enterTask = async (task: any) => {
  selectedTask.value = task
  currentView.value = 'exercises'
  
  // 获取任务的练习列表
  const taskData = await fetchTaskExercises(task.id)
  if (taskData) {
    selectedTask.value = {
      ...task,
      ...taskData.task,
      exams: taskData.exams || [],
      oj_problems: taskData.oj_problems || []
    }
  }
}

// 返回任务列表
const backToTasks = () => {
  currentView.value = 'tasks'
  selectedTask.value = null
}

// 开始客观题练习
const startExam = (exam: any) => {
  console.log('开始客观题练习:', exam)
  // 构建URL参数，只传递有效的值
  const params = new URLSearchParams()
  params.set('from', 'plan')
  if (selectedPlan.value?.id) {
    params.set('planId', selectedPlan.value.id.toString())
  }
  if (selectedTask.value?.id) {
    params.set('taskId', selectedTask.value.id.toString())
  }
  router.push(`/exam/${exam.id}?${params.toString()}`)
}

// 开始OJ题
const startOJ = (problem: any) => {
  console.log('开始OJ题:', problem)
  // 构建URL参数，只传递有效的值
  const params = new URLSearchParams()
  params.set('from', 'plan')
  if (selectedPlan.value?.id) {
    params.set('planId', selectedPlan.value.id.toString())
  }
  if (selectedTask.value?.id) {
    params.set('taskId', selectedTask.value.id.toString())
  }
  router.push(`/smartoj/${problem.id}?${params.toString()}`)
}

// 获取指定级别的可用计划
const getAvailablePlans = async (level: number) => {
  const plans = await fetchAvailablePlans(level)
  return plans
}

// 确认加入计划
const confirmJoinPlan = async () => {
  if (selectedJoinPlan.value) {
    const success = await joinPlan(selectedJoinPlan.value.id)
    if (success) {
      // 重新获取我的计划列表
      await fetchMyPlans()
      showJoinDialog.value = false
      selectedJoinPlan.value = null
    }
  }
}

// 监听级别变化，获取可用计划
watch(joinDialogLevel, async (newLevel) => {
  if (showJoinDialog.value) {
    allAvailablePlans.value = await getAvailablePlans(newLevel)
  }
})

// 监听弹窗显示，获取可用计划
watch(showJoinDialog, async (show) => {
  if (show) {
    allAvailablePlans.value = await getAvailablePlans(joinDialogLevel.value)
  }
})

// 拉取测试列表（需在下方 watch(route.path, { immediate: true }) 之前定义，否则 immediate 回调会报 “before initialization”）
const fetchTestsList = async () => {
  if (!userInfo.value?.id) return
  testsLoading.value = true
  try {
    const res = await fetch(`${BASE_URL}/tests?user_id=${userInfo.value.id}`)
    const data = await res.json()
    testsList.value = data.list ?? []
  } catch (e) {
    console.error('获取测试列表失败', e)
    testsList.value = []
  } finally {
    testsLoading.value = false
  }
}

const goToTest = (testId: number, _mode: 'start' | 'continue' | 'result') => {
  router.push(`/tests/${testId}`)
}

// 监听路由变化（侧栏对应独立路由），切换时拉取数据或重置状态
watch(() => route.path, async (path) => {
  const newView = planSectionFromPath(path)
  if (newView === 'global-ranking') {
    if (myPlans.value.length === 0) {
      await fetchMyPlans()
    }
    await fetchAllPlans()
  } else if (newView === 'my-plans') {
    if (currentView.value !== 'plans') {
      currentView.value = 'plans'
      selectedPlan.value = null
      selectedTask.value = null
    }
  } else if (newView === 'my-tests') {
    fetchTestsList()
  }
}, { immediate: true })

// 测试API连接
const testAPIConnection = async () => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`${BASE_URL}/health`, { 
      method: 'GET',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response.ok
  } catch (err) {
    console.error('API连接测试失败:', err)
    return false
  }
}

// 组件挂载
onMounted(async () => {
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
  
  // 获取用户信息
  const userInfoStr = localStorage.getItem('userInfo')
  if (userInfoStr) {
    userInfo.value = JSON.parse(userInfoStr)
    
    // 测试API连接
    const isConnected = await testAPIConnection()
    if (!isConnected) {
      error.value = '无法连接到服务器，请检查网络连接或联系管理员'
      return
    }
    
    // 加载我的学习计划
    await fetchMyPlans()
    // 若当前在「可参加的测试」页，此时 userInfo 已有值，补拉测试列表（否则 watch immediate 时 userInfo 尚未注入会显示暂无测试）
    if (route.path === '/plan/tests') {
      fetchTestsList()
    }
  } else {
    error.value = '请先登录'
  }
  
})
</script>

<style scoped>
/* 基础布局 */
.exam-layout {
  min-height: 100vh;
  width: 100vw;
  background: linear-gradient(135deg, #87ceeb 0%, #f8fafc 100%);
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  font-family: 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
}

.exam-content-flex-row {
  display: flex;
  flex-direction: row;
  gap: 32px;
  width: 100%;
  margin: 0 auto;
  padding: 0 20px 40px 20px;
  box-sizing: border-box;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: center;
  margin-top: 0;
}

/* 我的计划页内「加入计划」按钮（原右下角 FAB 已移入此视图） */
.my-plans-with-header {
  width: 100%;
}
.my-plans-header-actions {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}
.join-plan-btn-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid rgba(30, 144, 255, 0.5);
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(30, 144, 255, 0.3);
  transition: all 0.2s ease;
}
.join-plan-btn-inline:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(30, 144, 255, 0.4);
}
.empty-state .join-plan-btn-inline {
  margin-top: 16px;
}

/* 高质感加入计划按钮（弹窗内沿用） */
.join-plan-btn-premium {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 50%, #60a5fa 100%);
  color: white;
  border: 3px solid rgba(255, 255, 255, 0.6);
  padding: 14px 24px;
  border-radius: 16px;
  font-size: 1.2rem;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.25s ease;
  backdrop-filter: blur(10px);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 8px 22px rgba(30, 144, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.65);
  letter-spacing: 0.5px;
}

.join-plan-btn-premium:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 14px 28px rgba(30, 144, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.8);
  border-width: 4px;
}

.join-plan-btn-premium:active {
  transform: translateY(0);
  box-shadow: 0 6px 16px rgba(30, 144, 255, 0.28), inset 0 0 0 rgba(255,255,255,0.8);
}

/* 右侧固定边栏导航 */
.sidebar-right-fixed {
  position: fixed;
  top: 48px; /* 从导航栏下方开始 */
  right: 0;
  bottom: 0;
  width: 260px;
  z-index: 999;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  border-left: 6px solid #0c7cd5;
  box-shadow: -12px 0 40px rgba(30, 144, 255, 0.4);
  padding: 20px 14px;
  backdrop-filter: blur(10px);
  animation: slideRight 0.4s ease-out;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

@keyframes slideRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.sidebar-nav-item {
  background: rgba(255, 255, 255, 0.98);
  border: 5px solid rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  padding: 20px 16px;
  font-size: 1.6rem;
  font-weight: 900;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: visible;
}

.sidebar-nav-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
}

/* 我的计划 - 蓝色主题 */
.sidebar-nav-item-my-plans::before {
  background: linear-gradient(135deg, rgba(30, 144, 255, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%);
}

.sidebar-nav-item-my-plans:hover {
  transform: translateX(-4px) scale(1.05);
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.5);
  border-color: #fff;
  background: #fff;
  animation: bounceRight 0.5s ease;
}

.sidebar-nav-item-my-plans:hover::before {
  opacity: 1;
}

.sidebar-nav-item-my-plans.active {
  background: linear-gradient(135deg, #fff 0%, #e0f2fe 100%);
  border-color: #1e90ff;
  border-width: 6px;
  color: #1e90ff;
  box-shadow: 0 12px 40px rgba(30, 144, 255, 0.6);
  transform: translateX(-3px) scale(1.03);
  animation: pulseRight 2s ease-in-out infinite;
}

.sidebar-nav-item-my-plans.active::before {
  opacity: 1;
  background: linear-gradient(135deg, rgba(30, 144, 255, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%);
}

.sidebar-nav-item-my-plans.active span {
  color: #1e90ff;
  text-shadow: 0 3px 6px rgba(30, 144, 255, 0.3);
}

/* 计划排名 - 金色/橙色主题 */
.sidebar-nav-item-ranking::before {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%);
}

.sidebar-nav-item-ranking:hover {
  transform: translateX(-4px) scale(1.05);
  box-shadow: 0 12px 32px rgba(245, 158, 11, 0.5);
  border-color: #fff;
  background: #fff;
  animation: bounceRight 0.5s ease;
}

.sidebar-nav-item-ranking:hover::before {
  opacity: 1;
}

.sidebar-nav-item-ranking.active {
  background: linear-gradient(135deg, #fff 0%, #fef3c7 100%);
  border-color: #f59e0b;
  border-width: 6px;
  color: #d97706;
  box-shadow: 0 12px 40px rgba(245, 158, 11, 0.6);
  transform: translateX(-3px) scale(1.03);
  animation: pulseRightGold 2s ease-in-out infinite;
}

.sidebar-nav-item-ranking.active::before {
  opacity: 1;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(251, 191, 36, 0.2) 100%);
}

.sidebar-nav-item-ranking.active span {
  color: #d97706;
  text-shadow: 0 3px 6px rgba(245, 158, 11, 0.3);
}

/* 我的提交 - 绿色主题 */
.sidebar-nav-item-submissions::before {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(74, 222, 128, 0.1) 100%);
}
.sidebar-nav-item-submissions:hover {
  transform: translateX(-4px) scale(1.05);
  box-shadow: 0 12px 32px rgba(34, 197, 94, 0.5);
  border-color: #fff;
  background: #fff;
  animation: bounceRight 0.5s ease;
}
.sidebar-nav-item-submissions:hover::before { opacity: 1; }
.sidebar-nav-item-submissions.active {
  background: linear-gradient(135deg, #fff 0%, #dcfce7 100%);
  border-color: #22c55e;
  border-width: 6px;
  color: #16a34a;
  box-shadow: 0 12px 40px rgba(34, 197, 94, 0.6);
  transform: translateX(-3px) scale(1.03);
}
.sidebar-nav-item-submissions.active::before {
  opacity: 1;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(74, 222, 128, 0.2) 100%);
}
.sidebar-nav-item-submissions.active span {
  color: #16a34a;
  text-shadow: 0 3px 6px rgba(34, 197, 94, 0.3);
}

.my-submissions-view-wrap {
  width: 100%;
}

/* 我的测试 */
.my-tests-view {
  width: 100%;
}
.tests-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.test-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.test-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.test-card-header h4 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #0f172a;
}
.test-status {
  font-size: 0.85rem;
  padding: 2px 8px;
  border-radius: 6px;
}
.test-status.submitted { background: #dcfce7; color: #16a34a; }
.test-status.in-progress { background: #dbeafe; color: #2563eb; }
.test-status.not-started { background: #f1f5f9; color: #64748b; }
.test-card-desc {
  margin: 0 0 8px 0;
  color: #64748b;
  font-size: 0.9rem;
}
.test-card-meta {
  display: flex;
  gap: 12px;
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 12px;
}
.test-card-actions .test-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
}
.test-btn.primary {
  background: linear-gradient(135deg, #1e90ff, #38bdf8);
  color: #fff;
}
.test-btn.secondary {
  background: #e2e8f0;
  color: #475569;
}
.sidebar-nav-item-tests::before {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(129, 140, 248, 0.1) 100%);
}
.sidebar-nav-item-tests:hover {
  transform: translateX(-4px) scale(1.05);
  box-shadow: 0 12px 32px rgba(99, 102, 241, 0.5);
  border-color: #fff;
  background: #fff;
}
.sidebar-nav-item-tests:hover::before { opacity: 1; }
.sidebar-nav-item-tests.active {
  background: linear-gradient(135deg, #fff 0%, #e0e7ff 100%);
  border-color: #6366f1;
  border-width: 6px;
  color: #4f46e5;
  box-shadow: 0 12px 40px rgba(99, 102, 241, 0.6);
  transform: translateX(-3px) scale(1.03);
}
.sidebar-nav-item-tests.active::before {
  opacity: 1;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(129, 140, 248, 0.2) 100%);
}
.sidebar-nav-item-tests.active span {
  color: #4f46e5;
}

@keyframes bounceRight {
  0%, 100% {
    transform: translateX(-4px) scale(1.05);
  }
  50% {
    transform: translateX(-6px) scale(1.07);
  }
}

@keyframes pulseRight {
  0%, 100% {
    box-shadow: 0 12px 40px rgba(30, 144, 255, 0.6);
  }
  50% {
    box-shadow: 0 12px 50px rgba(30, 144, 255, 0.8);
  }
}

@keyframes pulseRightGold {
  0%, 100% {
    box-shadow: 0 12px 40px rgba(245, 158, 11, 0.6);
  }
  50% {
    box-shadow: 0 12px 50px rgba(245, 158, 11, 0.8);
  }
}

@keyframes pulseRightRed {
  0%, 100% {
    box-shadow: 0 12px 40px rgba(239, 68, 68, 0.6);
  }
  50% {
    box-shadow: 0 12px 50px rgba(239, 68, 68, 0.8);
  }
}

.sidebar-nav-item :deep(.lucide-icon) {
  color: inherit;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.sidebar-nav-item span {
  font-size: 1.6rem;
  font-weight: 900;
  letter-spacing: 1px;
  line-height: 1.2;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 上新角标：挂在按钮框右上角，非常醒目 */
.sidebar-nav-new-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 0.75rem !important;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 5px 12px;
  border-radius: 0 12px 0 14px;
  background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%);
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  box-shadow: 0 3px 10px rgba(220, 38, 38, 0.55);
  white-space: nowrap;
  z-index: 5;
  border: 2px solid rgba(255, 255, 255, 0.95);
}

.sidebar-nav-item:active {
  transform: translateX(-2px) scale(1.01);
}

.sidebar-placeholder-right {
  width: 50px;
  flex-shrink: 0;
}

.question-main {
  flex: 1;
  max-width: 1600px;
  min-width: 0;
}

.question-card {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 18px;
  box-shadow: 0 6px 24px -4px rgba(30, 144, 255, 0.1);
  transition: all 0.3s ease;
  padding: 0;
  overflow: visible;
  width: 100%;
  min-height: calc(100vh - 84px - 80px); /* 最小高度，允许内容超出 */
  display: flex;
  flex-direction: column;
  margin: 20px auto 0 auto; /* 减少上边距，让卡片上移 */
  box-sizing: border-box;
}

/* 计划列表视图时，卡片背景透明融入页面背景 */
.question-card.plan-view-transparent {
  background: transparent;
  border: none;
  box-shadow: none;
}

.question-card.plan-view-transparent .question-card-header {
  display: none; /* 计划列表视图时隐藏 header */
}

.question-card-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  padding: 12px 28px;
  border-bottom: 3px solid #e0f2fe;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.header-left-section {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 150px;
}

.header-center-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
}

.header-right-section {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 150px;
  justify-content: flex-end;
}

.question-number {
  display: flex;
  align-items: center;
  gap: 12px;
}

.number-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 10px 20px;
  border-radius: 24px;
  font-weight: 700;
  font-size: 1.1rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
}

.level-badge {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  padding: 8px 14px;
  border-radius: 18px;
  font-weight: 600;
  font-size: 0.95rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.join-plan-btn-header,
.back-btn-header {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 8px;
}

.join-plan-btn-header:hover,
.back-btn-header:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
}

.question-content-unified {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: visible;
  background: transparent; /* 透明背景，融入页面背景 */
}

.question-left-panel {
  flex: 1;
  overflow: visible;
  padding: 24px;
  padding-right: 280px; /* 为右侧边栏预留空间 */
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: transparent; /* 透明背景，融入页面背景 */
}

.question-left-panel-centered {
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

.content-section {
  background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
  border-radius: 24px;
  box-shadow: 0 12px 40px rgba(30, 144, 255, 0.3);
  overflow: visible;
  border: 6px solid #1e90ff;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: fit-content;
}

.section-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  padding: 24px 32px;
  border-bottom: 4px solid #0c7cd5;
  border-radius: 20px 20px 0 0;
  position: relative;
}

.section-title {
  margin: 0;
  color: white;
  font-size: 1.8rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 12px;
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
}

.section-title :deep(.lucide-icon) {
  flex-shrink: 0;
}

.section-content {
  padding: 24px;
  background: transparent;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 5rem;
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #1e90ff;
}

.empty-state h3 {
  color: #01579b;
  font-size: 2rem;
  margin: 0 0 16px 0;
  font-weight: 900;
  letter-spacing: 1px;
}

.empty-state p {
  color: #0277bd;
  font-size: 1.3rem;
  font-weight: 600;
}

/* 错误状态 */
.error-state {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 2px solid #fecaca;
}

.error-icon {
  font-size: 5rem;
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #dc2626;
}

.error-state h3 {
  color: #dc2626;
  font-size: 2rem;
  margin: 0 0 16px 0;
  font-weight: 900;
  letter-spacing: 1px;
}

.error-state p {
  color: #991b1b;
  font-size: 1.3rem;
  margin-bottom: 24px;
  font-weight: 600;
}

.retry-btn {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  color: white;
  border: 5px solid #b91c1c;
  padding: 16px 32px;
  border-radius: 16px;
  font-size: 1.2rem;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 16px rgba(220, 38, 38, 0.3);
}

.retry-btn:hover {
  background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

/* 加载状态 */
.loading-state {
  text-align: center;
  padding: 80px 32px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 6px solid #1e90ff;
  border-radius: 24px;
}

.loading-icon {
  font-size: 5rem;
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #1e90ff;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-state h3 {
  color: #1e90ff;
  font-size: 2rem;
  margin: 0 0 16px 0;
  font-weight: 900;
  letter-spacing: 1px;
}

.loading-state p {
  color: #0369a1;
  font-size: 1.3rem;
  font-weight: 600;
}

/* GESP考级备考阶段横幅（计划页） */
.preparation-banner {
  margin-bottom: 20px;
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  animation: planBannerSlideDown 0.5s ease-out;
}

@keyframes planBannerSlideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.preparation-banner .banner-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: white;
}

.preparation-banner .banner-content :deep(.lucide-icon) {
  flex-shrink: 0;
  margin-top: 2px;
  color: white;
}

.preparation-banner .banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preparation-banner .banner-text strong {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.preparation-banner .banner-text span {
  font-size: 14px;
  line-height: 1.5;
  opacity: 0.95;
}

/* 我的计划列表 */
.my-plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

/* 计划排名列表 */
.global-ranking-view {
  width: 100%;
}

.global-ranking-plans-list {
  display: flex;
  flex-direction: column;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.global-ranking-list-header {
  display: grid;
  grid-template-columns: 2fr 100px 120px 220px 140px;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  font-weight: 700;
  font-size: 1rem;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  position: sticky;
  top: 0;
  z-index: 10;
}

.global-ranking-list-row {
  display: grid;
  grid-template-columns: 2fr 100px 120px 220px 140px;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
  transition: all 0.2s ease;
  background: white;
  align-items: center;
  cursor: pointer;
}

.global-ranking-list-row:hover {
  background: #f8fafc;
  transform: translateX(2px);
}

.global-ranking-list-row.is-my-plan {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-left: 5px solid #f59e0b;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);
  font-weight: 600;
}

.global-ranking-list-row.is-my-plan:hover {
  background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
  border-left-width: 6px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.global-ranking-list-row:last-child {
  border-bottom: none;
}

.plan-name-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.plan-name-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}

.plan-name-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-name {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
}

.joined-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
  white-space: nowrap;
}

.joined-badge :deep(.lucide-icon) {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
}

.rank-badge :deep(.lucide-icon) {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
}

.rank-badge-first {
  background: linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%);
  color: #78350f;
  border-color: #f59e0b;
}

.rank-badge-second {
  background: linear-gradient(135deg, #cbd5e1 0%, #e2e8f0 100%);
  color: #475569;
  border-color: #94a3b8;
}

.rank-badge-third {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: #7c2d12;
  border-color: #ea580c;
}

.rank-badge-top-ten {
  background: linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%);
  color: #1e3a8a;
  border-color: #3b82f6;
}

.rank-badge-normal {
  background: linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%);
  color: #475569;
  border-color: #cbd5e1;
}

.plan-desc-text {
  margin: 0;
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.plan-level-col,
.plan-status-col,
.plan-time-col,
.plan-action-col {
  display: flex;
  align-items: center;
  justify-content: center;
}

.plan-level-badge-list {
  background: #1e90ff;
  color: white;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 700;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.plan-status-badge-list {
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 700;
  border: 2px solid;
  white-space: nowrap;
}

.plan-time-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

.plan-time-text :deep(.lucide-icon) {
  flex-shrink: 0;
  color: #94a3b8;
}

.ranking-btn-list {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: 3px solid #d97706;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  white-space: nowrap;
}

.ranking-btn-list:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  border-width: 4px;
}

.ranking-btn-list :deep(.lucide-icon) {
  flex-shrink: 0;
}

.plan-card {
  background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
  border: 4px solid #1e90ff;
  border-radius: 16px;
  padding: 0;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 6px 20px rgba(30, 144, 255, 0.2);
  overflow: hidden;
  min-height: 210px;
}

.plan-card:hover {
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.4);
  border-color: #0c7cd5;
  border-width: 5px;
}

.plan-card-header {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plan-level-badge {
  background: #1e90ff;
  color: white;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 800;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.plan-testing-badge {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.plan-status-badge {
  padding: 6px 12px;
  border-radius: 13px;
  font-size: 0.85rem;
  font-weight: 800;
  border: 2px solid;
}

.status-active {
  background: #d1fae5;
  color: #059669;
  border-color: #10b981 !important;
}

.status-upcoming {
  background: #fef3c7;
  color: #d97706;
  border-color: #f59e0b !important;
}

.status-ended {
  background: #fee2e2;
  color: #dc2626;
  border-color: #ef4444 !important;
}

.plan-card-body {
  padding: 16px;
}

.plan-card-body h3 {
  color: #1e293b;
  font-size: 1.4rem;
  margin: 0 0 10px 0;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.plan-desc {
  color: #64748b;
  font-size: 1rem;
  margin: 0 0 12px 0;
  line-height: 1.6;
  font-weight: 600;
}

.plan-time {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 0.85rem;
  margin-bottom: 12px;
}

.plan-progress {
  margin-top: 12px;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #1e90ff 0%, #38bdf8 100%);
  border-radius: 5px;
  transition: width 0.3s ease;
}

.progress-text {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 600;
}

.plan-card-footer {
  padding: 12px 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 10px;
}

.enter-plan-btn {
  flex: 1;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  border: 4px solid #0c7cd5;
  padding: 11px 16px;
  border-radius: 13px;
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 3px 13px rgba(30, 144, 255, 0.3);
  letter-spacing: 0.5px;
}

.ranking-btn {
  flex: 1;
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
  border: 4px solid #d97706;
  padding: 11px 16px;
  border-radius: 13px;
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 3px 13px rgba(245, 158, 11, 0.3);
  letter-spacing: 0.5px;
}

.ranking-btn:hover {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 5px 16px rgba(245, 158, 11, 0.4);
  border-width: 5px;
}

.ranking-btn-full {
  width: 100%;
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
  border: 4px solid #d97706;
  padding: 11px 16px;
  border-radius: 13px;
  font-size: 0.9rem;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 3px 13px rgba(245, 158, 11, 0.3);
  letter-spacing: 0.5px;
}

.ranking-btn-full:hover {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
  border-width: 6px;
}

.plan-ranking-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.ranking-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.ranking-badge.rank-first {
  background: linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%);
  color: #78350f;
}

.ranking-badge.rank-second {
  background: linear-gradient(135deg, #cbd5e1 0%, #e2e8f0 100%);
  color: #475569;
}

.ranking-badge.rank-third {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: #7c2d12;
}

.ranking-badge.rank-top-ten {
  background: linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%);
  color: #1e3a8a;
}

.ranking-badge.rank-normal {
  background: linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%);
  color: #475569;
}

.enter-plan-btn :deep(.lucide-icon) {
  flex-shrink: 0;
}

.enter-plan-btn:hover {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4);
  border-width: 6px;
}

/* 计划信息卡片 */
.plan-info-card {
  margin-bottom: 24px;
}

.plan-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.plan-info-header h2 {
  color: #1e293b;
  font-size: 2rem;
  margin: 0;
  font-weight: 900;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.plan-level-badge-large {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 18px;
  font-size: 1.2rem;
  font-weight: 900;
  border: 3px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
}

.plan-info-desc {
  color: #64748b;
  font-size: 1.2rem;
  margin: 0 0 24px 0;
  line-height: 1.8;
  font-weight: 600;
}

.plan-info-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.info-stat {
  text-align: center;
  padding: 16px;
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
  border-radius: 12px;
  border: 1px solid #bae6fd;
}

.stat-value {
  display: block;
  font-size: 2.5rem;
  font-weight: 900;
  color: #1e90ff;
  margin-bottom: 6px;
}

.stat-label {
  color: #64748b;
  font-size: 1.1rem;
  font-weight: 600;
}

/* 任务列表 */
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.task-item {
  display: flex;
  gap: 16px;
  padding: 28px;
  background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
  border: 5px solid #1e90ff;
  border-radius: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 8px 24px rgba(30, 144, 255, 0.2);
}

.task-item:hover {
  border-color: #0c7cd5;
  border-width: 6px;
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.4);
  transform: translateY(-2px);
}

.task-item.completed {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
}

.task-item.active {
  border-color: #38bdf8;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}

.task-number {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 1.3rem;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
}

.task-main-content {
  flex: 1;
}

.task-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-main-content h4 {
  color: #1e293b;
  font-size: 1.6rem;
  margin: 0;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.task-status-badge {
  padding: 8px 16px;
  border-radius: 16px;
  font-size: 1rem;
  font-weight: 700;
  border: 3px solid;
}

.status-completed {
  background: #d1fae5;
  color: #059669;
  border-color: #10b981 !important;
}

.status-overdue {
  background: #fee2e2;
  color: #dc2626;
  border-color: #ef4444 !important;
}

.task-desc {
  color: #64748b;
  font-size: 1.1rem;
  margin: 0 0 16px 0;
  line-height: 1.8;
  font-weight: 600;
}

.task-review {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #fcd34d;
  margin-bottom: 16px;
}

.review-label {
  color: #92400e;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.review-content {
  color: #78350f;
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 8px;
}

.video-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1e90ff;
  font-weight: 600;
  font-size: 0.9rem;
  text-decoration: none;
  transition: all 0.3s ease;
}

.video-link:hover {
  color: #0c7cd5;
  transform: translateX(4px);
}

.task-time {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 1.1rem;
  margin-bottom: 16px;
  font-weight: 600;
}

.task-time :deep(.lucide-icon) {
  flex-shrink: 0;
}

.task-exercises-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.exercise-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 1.1rem;
  font-weight: 600;
}

.exercise-stat :deep(.lucide-icon) {
  flex-shrink: 0;
}

.task-actions {
  display: flex;
  gap: 12px;
}

.task-action-btn {
  padding: 14px 20px;
  border: 5px solid #0c7cd5;
  border-radius: 16px;
  font-size: 1.1rem;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0.5px;
}

.start-btn {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
  border-color: #059669;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.start-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
  border-width: 6px;
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 任务信息卡片 */
.task-info-card {
  margin-bottom: 24px;
}

.task-info-card h2 {
  color: #01579b;
  font-size: 2rem;
  margin: 0 0 16px 0;
  font-weight: 900;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.task-info-desc {
  color: #0277bd;
  font-size: 1.2rem;
  margin: 0 0 24px 0;
  line-height: 1.8;
  font-weight: 600;
}

.review-section {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  padding: 24px;
  border-radius: 16px;
  border: 5px solid #f59e0b;
  margin-top: 24px;
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.2);
}

.review-section h4 {
  color: #78350f;
  font-size: 1.4rem;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.review-section h4 :deep(.lucide-icon) {
  flex-shrink: 0;
}

.review-content-box {
  background: rgba(255, 255, 255, 0.5);
  padding: 20px;
  border-radius: 12px;
  color: #78350f;
  line-height: 1.8;
  margin-bottom: 16px;
  font-size: 1.1rem;
  font-weight: 600;
}

.video-link-large {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  padding: 16px 28px;
  border: 5px solid #0c7cd5;
  border-radius: 16px;
  text-decoration: none;
  font-weight: 900;
  font-size: 1.1rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
  letter-spacing: 0.5px;
}

.video-link-large :deep(.lucide-icon) {
  flex-shrink: 0;
}

.video-link-large:hover {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4);
  border-width: 6px;
}

/* 练习网格 */
.exercises-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.exercise-card {
  background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
  border: 5px solid #1e90ff;
  border-radius: 20px;
  padding: 28px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(30, 144, 255, 0.2);
}

.exercise-card:hover {
  border-color: #0c7cd5;
  border-width: 6px;
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.4);
}

.exercise-icon {
  font-size: 3.5rem;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #1e90ff;
}

.exercise-card h4 {
  color: #01579b;
  font-size: 1.4rem;
  margin: 0 0 12px 0;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.exercise-desc {
  color: #0277bd;
  font-size: 1.05rem;
  margin: 0 0 16px 0;
  line-height: 1.7;
  font-weight: 600;
}

.exercise-info {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 0.85rem;
  color: #64748b;
}

.difficulty-badge {
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
}

.difficulty-easy {
  background: #d1fae5;
  color: #059669;
}

.difficulty-medium {
  background: #fed7aa;
  color: #d97706;
}

.difficulty-hard {
  background: #fecaca;
  color: #dc2626;
}

.exercise-status {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 8px 16px;
  border-radius: 16px;
  font-size: 0.9rem;
  font-weight: 700;
  border: 3px solid;
}

.status-pending {
  background: #fee2e2;
  color: #dc2626;
  border-color: #ef4444 !important;
}

.status-completed {
  background: #d1fae5;
  color: #059669;
  border-color: #10b981 !important;
}

/* 加入计划弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalSlideIn 0.3s ease;
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

.modal-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  padding: 24px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #e0f2fe;
}

.modal-header h3 {
  color: white;
  font-size: 1.8rem;
  font-weight: 900;
  margin: 0;
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
}

.ranking-modal-header h3 {
  font-size: 1.4rem;
}

/* 排名弹窗header特殊样式 */
.ranking-modal-header {
  padding: 12px 20px;
  flex-wrap: nowrap;
  gap: 16px;
  align-items: center;
}

.modal-header-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  align-items: flex-start;
}

.modal-header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 0;
}

.modal-header-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
}

.ranking-plan-info-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  text-align: center;
}

.ranking-plan-info-header h4 {
  color: white;
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.ranking-plan-info-header p {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  margin: 0;
  font-weight: 500;
}

.ranking-teacher-info-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 0.9rem;
  font-weight: 500;
}

.ranking-teacher-info-header :deep(.lucide-icon) {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.9);
}

.current-student-ranking-header {
  display: flex;
  align-items: center;
}

.current-rank-badge-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  font-weight: 700;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.95);
}

.current-rank-badge-header .rank-number {
  font-size: 1.3rem;
  line-height: 1;
}

.current-rank-badge-header .rank-total {
  font-size: 0.75rem;
}

.current-rank-badge-header :deep(.lucide-icon) {
  flex-shrink: 0;
}

.current-rank-badge-header.rank-first {
  background: linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%);
  color: #78350f;
}

.current-rank-badge-header.rank-second {
  background: linear-gradient(135deg, #cbd5e1 0%, #e2e8f0 100%);
  color: #475569;
}

.current-rank-badge-header.rank-third {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: #7c2d12;
}

.current-rank-badge-header.rank-top-ten {
  background: linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%);
  color: #1e3a8a;
}

.current-rank-badge-header.rank-normal {
  background: rgba(255, 255, 255, 0.95);
  color: #475569;
}

.not-in-plan-header {
  display: flex;
  align-items: center;
}

.not-in-plan-notice-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.95);
  font-size: 0.9rem;
  font-weight: 500;
}

.not-in-plan-notice-header :deep(.lucide-icon) {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.9);
}

.not-in-plan-notice-header {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.ranking-modal-header .modal-close-btn {
  width: 56px;
  height: 56px;
  border-width: 3px;
  border-radius: 16px;
}

.modal-close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  color: white;
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  font-size: 18px;
  backdrop-filter: blur(10px);
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

/* 加载状态下的 modal-body，使用 flex 布局让加载动画居中 */
.modal-body-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px; /* 确保有足够的高度 */
}

.level-selector {
  margin-bottom: 24px;
}

.level-label {
  font-size: 1.3rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
}

.level-buttons {
  display: flex;
  gap: 12px;
}

.level-btn {
  flex: 1;
  padding: 16px 24px;
  border: 5px solid #e2e8f0;
  border-radius: 16px;
  background: white;
  color: #64748b;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 0.5px;
}

.level-btn:hover {
  border-color: #1e90ff;
  color: #1e90ff;
}

.level-btn.active {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  border-color: #1e90ff;
  color: white;
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4);
  border-width: 6px;
}

.available-plans {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.plan-option {
  border: 5px solid #e2e8f0;
  border-radius: 20px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%);
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.15);
}

.plan-option:hover {
  border-color: #1e90ff;
  border-width: 6px;
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.3);
}

.plan-option.selected {
  border-color: #1e90ff;
  border-width: 6px;
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.4);
}

.plan-option-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.plan-option h4 {
  color: #1e293b;
  font-size: 1.5rem;
  margin: 0;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.plan-level-tag {
  background: #1e90ff;
  color: white;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
}

.plan-option p {
  color: #64748b;
  margin: 0 0 12px 0;
  line-height: 1.8;
  font-size: 1.1rem;
  font-weight: 600;
}

.plan-meta {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: #64748b;
}

.plan-meta span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.modal-footer {
  padding: 20px 28px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
}

.btn-cancel {
  background: #f1f5f9;
  color: #64748b;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-confirm {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  border: 5px solid #0c7cd5;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4);
  border-width: 6px;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 排名弹窗样式 */
.ranking-modal {
  max-width: 1400px;
  width: 95%;
  max-height: 90vh;
  min-height: 600px; /* 确保弹窗一开始就很大 */
}

.ranking-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 24px;
  color: #1e90ff;
  width: 100%;
  height: 100%;
  min-height: 500px; /* 确保有足够的高度 */
}

.loading-animation-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  position: relative;
}

.loading-trophy {
  position: relative;
  animation: trophyBounce 1.5s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(245, 158, 11, 0.4));
}

.loading-trophy :deep(.lucide-icon) {
  color: #f59e0b;
  animation: trophyRotate 2s ease-in-out infinite;
}

@keyframes trophyBounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-12px) scale(1.1);
  }
}

@keyframes trophyRotate {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-5deg);
  }
  75% {
    transform: rotate(5deg);
  }
}

.loading-dots {
  display: flex;
  gap: 12px;
  align-items: center;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  animation: dotBounce 1.4s ease-in-out infinite;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
}

.dot-1 {
  animation-delay: 0s;
  background: linear-gradient(135deg, #1e90ff 0%, #60a5fa 100%);
}

.dot-2 {
  animation-delay: 0.2s;
  background: linear-gradient(135deg, #38bdf8 0%, #60a5fa 100%);
}

.dot-3 {
  animation-delay: 0.4s;
  background: linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%);
}

@keyframes dotBounce {
  0%, 80%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.7;
  }
  40% {
    transform: translateY(-16px) scale(1.2);
    opacity: 1;
  }
}

.loading-text {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  letter-spacing: 0.5px;
}

.loading-ellipsis {
  display: inline-block;
  margin-left: 4px;
}

.ellipsis-dot {
  display: inline-block;
  animation: ellipsisDot 1.4s ease-in-out infinite;
  opacity: 0;
}

.ellipsis-dot:nth-child(1) {
  animation-delay: 0s;
}

.ellipsis-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.ellipsis-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes ellipsisDot {
  0%, 20% {
    opacity: 0;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-4px);
  }
  80%, 100% {
    opacity: 0;
    transform: translateY(0);
  }
}

.ranking-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ranking-plan-info {
  text-align: center;
  padding: 16px;
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
  border-radius: 12px;
  border: 2px solid #bae6fd;
}

.ranking-plan-info h4 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 1.6rem;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.ranking-plan-info p {
  margin: 0;
  color: #64748b;
  font-size: 0.95rem;
}

.ranking-teacher-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 10px;
  color: #475569;
  font-size: 0.95rem;
  font-weight: 500;
}

.current-student-ranking {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

.current-student-ranking.not-in-plan {
  margin: 16px 0;
}

.not-in-plan-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #f59e0b;
  border-radius: 12px;
  color: #92400e;
  font-size: 0.95rem;
  font-weight: 600;
}

.not-in-plan-notice :deep(.lucide-icon) {
  color: #d97706;
  flex-shrink: 0;
}

.current-rank-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-radius: 16px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.current-rank-badge.rank-first {
  background: linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%);
  color: #78350f;
}

.current-rank-badge.rank-second {
  background: linear-gradient(135deg, #cbd5e1 0%, #e2e8f0 100%);
  color: #475569;
}

.current-rank-badge.rank-third {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: #7c2d12;
}

.current-rank-badge.rank-top-ten {
  background: linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%);
  color: #1e3a8a;
}

.current-rank-badge.rank-normal {
  background: linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%);
  color: #475569;
}

.rank-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rank-number {
  font-size: 1.8rem;
  line-height: 1;
  font-weight: 900;
}

.rank-total {
  font-size: 0.85rem;
  opacity: 0.8;
  font-weight: 500;
}

.ranking-list {
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  /* 移除 overflow: hidden，让 sticky 表头正常工作 */
}

.ranking-list-header {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  padding: 10px 20px;
  border-bottom: 2px solid #e0f2fe;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ranking-list-header h4 {
  margin: 0;
  color: white;
  font-size: 1.2rem;
  font-weight: 900;
  letter-spacing: 0.5px;
}

.ranking-header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.teacher-filter-toggle {
  display: flex;
  align-items: center;
}

.filter-toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  user-select: none;
}

.filter-toggle-label:hover {
  background: white;
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.filter-toggle-label :deep(.lucide-icon) {
  flex-shrink: 0;
  color: #64748b;
}

.filter-toggle-label span {
  white-space: nowrap;
}

.filter-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #1e90ff;
  flex-shrink: 0;
}

.filter-toggle-label :deep(.lucide-icon) {
  width: 16px;
  height: 16px;
}

.filter-checkbox:checked + :deep(.lucide-icon) {
  color: #1e90ff;
}

.ranking-search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  padding: 6px 10px;
  min-width: 200px;
  max-width: 350px;
  flex: 1;
  transition: all 0.3s ease;
}

.ranking-search-box:focus-within {
  background: white;
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.ranking-search-box :deep(.lucide-icon) {
  flex-shrink: 0;
  color: #64748b;
  width: 16px;
  height: 16px;
}

.ranking-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.85rem;
  color: #1e293b;
  font-weight: 500;
}

.ranking-search-input::placeholder {
  color: #94a3b8;
}

.ranking-search-clear {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  transition: all 0.2s ease;
  border-radius: 4px;
  flex-shrink: 0;
}

.ranking-search-clear:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.ranking-search-clear :deep(.lucide-icon) {
  flex-shrink: 0;
}


.ranking-table-header {
  display: grid;
  grid-template-columns: 80px 1fr 150px 200px 120px;
  gap: 16px;
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  font-weight: 700;
  font-size: 0.9rem;
  color: #475569;
  position: sticky;
  top: 0;
  z-index: 10;
}

.ranking-table-row {
  display: grid;
  grid-template-columns: 80px 1fr 150px 200px 120px;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  transition: all 0.2s ease;
  background: white;
}

.ranking-table-row:hover {
  background: #f8fafc;
}

.ranking-table-row.is-current {
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
  border-left: 4px solid #1e90ff;
  font-weight: 600;
}

.ranking-table-row.top-three {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.rank-col {
  display: flex;
  align-items: center;
}

.rank-number-display {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 1rem;
}

.rank-number-display.rank-first {
  background: linear-gradient(135deg, #fbbf24 0%, #fcd34d 100%);
  color: #78350f;
}

.rank-number-display.rank-second {
  background: linear-gradient(135deg, #cbd5e1 0%, #e2e8f0 100%);
  color: #475569;
}

.rank-number-display.rank-third {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: #7c2d12;
}

.rank-number-display.rank-top-ten {
  background: linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%);
  color: #1e3a8a;
}

.rank-number-display.rank-normal {
  background: #e2e8f0;
  color: #475569;
}

.medal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.name-col {
  display: flex;
  align-items: center;
  gap: 8px;
}

.student-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 1.1rem;
}

.current-badge {
  background: #1e90ff;
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
}

.teacher-col {
  display: flex;
  align-items: center;
}

.teacher-name {
  font-weight: 500;
  color: #475569;
  font-size: 0.95rem;
}

.progress-col {
  display: flex;
  align-items: center;
}

.student-progress {
  width: 100%;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.85rem;
  color: #64748b;
  align-items: center;
}

.progress-main {
  font-weight: 600;
  color: #1e293b;
}

.progress-percent {
  font-weight: 600;
  color: #1e90ff;
}

.progress-details {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 0.75rem;
  color: #94a3b8;
  flex-wrap: wrap;
}

.progress-detail-item {
  display: inline-flex;
  align-items: center;
}

.progress-bar-mini {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill-mini {
  height: 100%;
  background: linear-gradient(90deg, #1e90ff 0%, #38bdf8 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.no-progress {
  color: #94a3b8;
  font-size: 0.85rem;
}

.status-col {
  display: flex;
  align-items: center;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-badge.completed {
  background: #d1fae5;
  color: #059669;
}

.status-badge.in-progress {
  background: #fef3c7;
  color: #d97706;
}

.ranking-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
  color: #dc2626;
  text-align: center;
}

.ranking-error p {
  margin: 0;
  font-size: 1rem;
  color: #991b1b;
}

/* 学习总结（费恩曼学习法）样式 */
.feynman-recorder .feynman-intro {
  color: #475569;
  font-size: 1.2rem;
  line-height: 1.8;
  margin-bottom: 20px;
  font-weight: 600;
}

.recorder-panel {
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.recorder-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.rec-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: 2px solid #bae6fd;
  background: white;
  color: #1e90ff;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rec-btn.start { border-color: #86efac; color: #16a34a; }
.rec-btn.stop { border-color: #fecaca; color: #dc2626; }
.rec-btn.download { border-color: #bae6fd; color: #1e90ff; }
.rec-btn.danger { border-color: #fecaca; color: #dc2626; }

.rec-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(30,144,255,0.15); }
.rec-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

.record-timer {
  margin-left: auto;
  font-weight: 700;
  color: #64748b;
}
.record-timer.active { color: #dc2626; }

.recorder-preview { margin-top: 8px; }
.preview-video { width: 100%; max-height: 360px; border-radius: 10px; border: 2px solid #e2e8f0; background: #000; }
.preview-actions { margin-top: 10px; display: flex; gap: 10px; }

.recorder-permission-tip { color: #dc2626; font-weight: 600; margin-top: 10px; }

/* 响应式设计 */
@media (max-width: 768px) {
  .exam-content-flex-row {
    flex-direction: column;
    gap: 16px;
    padding: 0 16px;
  }
  
  .sidebar-right-fixed {
    width: 240px;
    padding: 16px 12px;
    border-left-width: 5px;
  }
  
  .sidebar-nav-item {
    padding: 16px 12px;
    font-size: 1.4rem;
    gap: 8px;
    border-width: 4px;
    border-radius: 18px;
  }
  
  .sidebar-nav-item :deep(.lucide-icon) {
    width: 28px;
    height: 28px;
  }
  
  .sidebar-nav-item span {
    font-size: 1.4rem;
    letter-spacing: 0.5px;
  }
  
  .sidebar-nav-item.active {
    border-width: 5px;
    transform: translateX(-2px) scale(1.02);
  }
  
  .question-left-panel {
    padding-right: 0;
  }
  
  .sidebar-placeholder-right {
    display: none;
  }
  
  .join-plan-fab {
    bottom: 20px;
    right: 20px;
  }
  
  .join-plan-btn-premium {
    padding: 12px 20px;
    font-size: 1rem;
  }
  
  /* 在移动端隐藏右侧边栏 */
  .sidebar-right-fixed {
    display: none;
  }
  
  /* 移动端列表格式调整 */
  .global-ranking-list-header,
  .global-ranking-list-row {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px 16px;
  }
  
  .plan-name-col,
  .plan-level-col,
  .plan-status-col,
  .plan-time-col,
  .plan-action-col {
    justify-content: flex-start;
  }
  
  .plan-name-col {
    grid-column: 1;
  }
  
  .plan-level-col,
  .plan-status-col {
    display: inline-flex;
    margin-right: 12px;
  }
  
  .plan-time-col {
    grid-column: 1;
  }
  
  .plan-action-col {
    grid-column: 1;
  }
  
  .global-ranking-list-header {
    display: none; /* 移动端隐藏表头 */
  }
  
  .question-main {
    max-width: 100%;
  }
  
  .question-card {
    height: auto;
    min-height: calc(100vh - 20px);
  }
  
  .question-left-panel {
    padding: 16px;
    gap: 16px;
  }
  
  .my-plans-grid {
    grid-template-columns: 1fr;
  }
  
  .exercises-grid {
    grid-template-columns: 1fr;
  }
  
  .task-item {
    flex-direction: column;
    gap: 16px;
  }
  
  .task-number {
    width: 36px;
    height: 36px;
    font-size: 1rem;
  }
  
  .task-exercises-stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .modal-content {
    width: 95%;
    max-height: 90vh;
  }
  
  .modal-header {
    padding: 20px 24px;
  }
  
  .modal-header h3 {
    font-size: 1.2rem;
  }
  
  .ranking-modal-header {
    padding: 10px 16px;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .modal-header-left {
    width: 100%;
    order: 1;
  }
  
  .modal-header-center {
    width: 100%;
    order: 2;
    justify-content: center;
  }
  
  .modal-header-right {
    width: 100%;
    justify-content: space-between;
    order: 3;
    margin-top: 0;
  }
  
  .ranking-modal-header h3 {
    font-size: 1.1rem;
  }
  
  .ranking-plan-info-header h4 {
    font-size: 0.95rem;
  }
  
  .ranking-plan-info-header p {
    font-size: 0.8rem;
  }
  
  .current-rank-badge-header {
    padding: 8px 12px;
    gap: 6px;
  }
  
  .current-rank-badge-header .rank-number {
    font-size: 1.1rem;
  }
  
  .current-rank-badge-header .rank-total {
    font-size: 0.7rem;
  }
  
  .ranking-teacher-info-header {
    font-size: 0.8rem;
  }
  
  .modal-body {
    padding: 20px 24px;
  }
  
  .level-buttons {
    flex-wrap: wrap;
  }
  
  .level-btn {
    flex: 1 1 calc(50% - 6px);
  }
  
  .plan-card-footer {
    flex-direction: column;
  }
  
  .enter-plan-btn,
  .ranking-btn {
    width: 100%;
  }
  
  .ranking-table-header,
  .ranking-table-row {
    grid-template-columns: 60px 1fr 120px 150px 100px;
    gap: 8px;
    padding: 12px 16px;
    font-size: 0.85rem;
  }
  
  .ranking-list-header {
    padding: 8px 16px;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .ranking-list-header h4 {
    font-size: 1rem;
  }
  
  .ranking-header-controls {
    flex-direction: column;
    width: 100%;
    gap: 10px;
  }
  
  .teacher-filter-toggle {
    width: 100%;
  }
  
  .filter-toggle-label {
    width: 100%;
    justify-content: center;
  }
  
  .ranking-search-box {
    min-width: 100%;
    max-width: 100%;
  }
  
  .current-rank-badge {
    padding: 12px 20px;
  }
  
  .rank-number {
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .question-card-header {
    padding: 16px 20px;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }
  
  .join-plan-btn-header,
  .back-btn-header {
    padding: 8px 16px;
    font-size: 0.85rem;
  }
  
  .number-badge {
    font-size: 0.95rem;
    padding: 8px 16px;
  }
  
  .plan-card-body h3 {
    font-size: 1.1rem;
  }
  
  .task-item {
    padding: 16px;
  }
  
  .task-main-content h4 {
    font-size: 1.1rem;
  }
  
  .modal-footer {
    padding: 16px 20px;
  }
}
</style>

