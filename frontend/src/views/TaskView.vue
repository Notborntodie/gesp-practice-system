<template>
    <div class="exam-layout">
      <div class="exam-content exam-content-flex-row">
        <!-- 左侧返回按钮 -->
        <div class="sidebar-placeholder-left">
          <button 
            class="back-nav-arrow" 
            @click="backToTasks" 
            title="返回任务列表"
          >
            <Icon name="arrow-left" :size="32" />
          </button>
        </div>
        <div class="question-main">
          <div class="question-card task-view-transparent">
            <div class="question-card-header">
              <div class="header-left-section"></div>
              <div class="header-center-section">
              </div>
              <div class="header-right-section">
                <span class="level-badge" v-if="selectedLevel">GESP {{ selectedLevel }}级</span>
              </div>
            </div>
  
            <div class="question-content-unified">
              <div class="question-left-panel question-left-panel-centered" style="width: 100%;">
                  <div v-if="error" class="content-section error-state">
                    <div class="section-content">
                      <div class="error-icon"><Icon name="alert-triangle" :size="80" /></div>
                      <h3>连接错误</h3>
                      <p>{{ error }}</p>
                  </div>
                  </div>
                  
                  <div v-else-if="loading" class="content-section loading-state">
                  <div class="section-content">
                      <div class="loading-icon"><Icon name="loader-2" :size="80" spin /></div>
                      <h3>加载中...</h3>
                  <p>正在获取任务详情</p>
                    </div>
                    </div>
                    
              <template v-else>
                <!-- 考试模式界面 -->
                <template v-if="isExamMode">
                  <!-- 考试模式任务完成提示 -->
                  <div v-if="taskProgress?.task_progress?.is_completed" class="content-section completion-banner">
                    <div class="section-content">
                      <div class="completion-message">
                        <span class="completion-icon"><Icon name="sparkles" :size="64" /></span>
                        <h3>恭喜，考试已完成！</h3>
                        <p v-if="taskProgress.task_progress.completed_at" class="completion-time">
                          完成时间: {{ formatDateTime(taskProgress.task_progress.completed_at) }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 考试模式主界面 -->
                  <div class="content-section exam-mode-card" v-if="selectedTask">
                    <div class="section-content">
                      <div class="exam-mode-header">
                        <div class="exam-mode-badge">
                          <Icon name="clipboard-check" :size="24" />
                          <span>考试模式</span>
                        </div>
                        <h2>{{ selectedTask.name }}</h2>
                        <p class="exam-mode-desc">{{ selectedTask.description }}</p>
                        <p class="exam-mode-notice">
                          <Icon name="alert-circle" :size="16" />
                          考试模式下不显示答案和解析，请认真作答。客观题和编程题的解析将于考试时间结束（{{ taskEndTimeFormatted ? `任务结束时间：${taskEndTimeFormatted}` : '任务时间结束' }}）后才开放。
                        </p>
                      </div>

                      <!-- 考试已结束提示 -->
                      <div v-if="isExamExpired()" class="exam-ended-notice">
                        <div class="ended-notice-content">
                          <Icon name="info" :size="20" />
                          <p>考试时间已结束，您可以点击"开始补考"继续练习，或查看提交记录。</p>
                        </div>
                      </div>

                      <!-- 考试题目列表 -->
                      <div class="exam-mode-sections">
                        <!-- 客观题部分 -->
                        <div v-if="selectedTask?.exams?.length > 0" class="exam-mode-section">
                          <div class="exam-section-header">
                            <Icon name="file-text" :size="22" />
                            <h3>客观题</h3>
                            <span class="exam-count">共 {{ selectedTask.exams.length }} 套</span>
                          </div>
                          <div class="exam-items-grid">
                            <div 
                              v-for="(exam, index) in selectedTask.exams" 
                              :key="exam.id"
                              class="exam-item-card"
                              :class="{ 'exam-ended': isExamExpired() }"
                            >
                              <div class="exam-item-number">{{ index + 1 }}</div>
                              <div class="exam-item-info">
                                <h4>{{ exam.name }}</h4>
                                <p v-if="exam.description">{{ exam.description }}</p>
                                <!-- 今天剩余提交次数 -->
                                <div class="exam-submission-count-info" v-if="examSubmissionCounts[exam.id] !== undefined">
                                  <Icon name="clock" :size="12" />
                                  <span>今日剩余: {{ examSubmissionCounts[exam.id]?.remaining || 0 }}/3次</span>
                                </div>
                              </div>
                              <div class="exam-item-score" :class="{ 'has-score': exam.best_score !== undefined && exam.best_score !== null }">
                                {{ exam.best_score !== undefined && exam.best_score !== null ? exam.best_score + '分' : '未作答' }}
                              </div>
                              <!-- 考试未结束时显示开始考试按钮 -->
                              <button 
                                v-if="!isExamExpired()"
                                @click="startExam(exam)" 
                                class="btn-exam-action btn-start-exam"
                                :class="{ 'btn-frozen': examSubmissionCounts[exam.id]?.remaining === 0 }"
                                :disabled="examSubmissionCounts[exam.id]?.remaining === 0"
                                :title="examSubmissionCounts[exam.id]?.remaining === 0 ? '今日提交次数已用完，请明天再试' : '开始考试'"
                              >
                                <Icon :name="examSubmissionCounts[exam.id]?.remaining === 0 ? 'lock' : 'play'" :size="16" />
                                <span>{{ examSubmissionCounts[exam.id]?.remaining === 0 ? '已冻结' : '开始考试' }}</span>
                              </button>
                              <!-- 考试结束后显示开始补考和查看提交记录按钮 -->
                              <div v-else class="exam-action-group">
                                <button 
                                  @click="startExam(exam)" 
                                  class="btn-exam-action btn-start-exam"
                                  :class="{ 'btn-frozen': examSubmissionCounts[exam.id]?.remaining === 0 }"
                                  :disabled="examSubmissionCounts[exam.id]?.remaining === 0"
                                  :title="examSubmissionCounts[exam.id]?.remaining === 0 ? '今日提交次数已用完，请明天再试' : '开始补考'"
                                >
                                  <Icon :name="examSubmissionCounts[exam.id]?.remaining === 0 ? 'lock' : 'refresh-cw'" :size="16" />
                                  <span>{{ examSubmissionCounts[exam.id]?.remaining === 0 ? '已冻结' : '开始补考' }}</span>
                                </button>
                                <button 
                                  @click="viewExamSubmissions(exam)" 
                                  class="btn-exam-action"
                                  title="查看提交记录"
                                >
                                  <Icon name="clipboard-list" :size="16" />
                                  <span>提交记录</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- 编程题部分 -->
                        <div v-if="selectedTask?.oj_problems?.length > 0" class="exam-mode-section">
                          <div class="exam-section-header">
                            <Icon name="code" :size="22" />
                            <h3>编程题</h3>
                          </div>
                          <!-- 规则说明 -->
                          <div class="oj-rules-info exam-mode-rules">
                            <Icon name="info" :size="18" />
                            <div class="rules-content">
                              <div class="rules-title">编程题规则</div>
                              <div class="rules-details">
                                <span class="rule-item">必须AC才算完成</span>
                              </div>
                            </div>
                          </div>
                          <div class="exam-items-grid">
                            <div 
                              v-for="(problem, index) in selectedTask.oj_problems" 
                              :key="problem.id"
                              class="exam-item-card"
                              :class="{ 'exam-ended': isExamExpired() }"
                            >
                              <div class="exam-item-number">{{ index + 1 }}</div>
                              <div class="exam-item-info">
                                <h4>{{ problem.title }}</h4>
                               
                              </div>
                              <div class="exam-item-score" :class="{ 'has-score': problem.best_verdict, 'score-ac': problem.best_verdict === 'Accepted', 'score-pac': problem.best_verdict && problem.best_verdict.includes('PAC') }">
                                {{ problem.best_verdict ? (problem.best_verdict === 'Accepted' ? 'AC' : (getOJScore(problem) > 0 ? getOJScore(problem) + '分' : problem.best_verdict)) : '未作答' }}
                              </div>
                              <!-- 考试未结束时显示开始答题按钮 -->
                              <button 
                                v-if="!isExamExpired()"
                                @click="startOJ(problem)" 
                                class="btn-exam-action btn-start-exam"
                                title="开始答题"
                              >
                                <Icon name="play" :size="16" />
                                <span>开始答题</span>
                              </button>
                              <!-- 考试结束后显示开始补考和讲解视频按钮 -->
                              <div v-else class="exam-action-group">
                                <button 
                                  @click="startOJ(problem)" 
                                  class="btn-exam-action btn-start-exam"
                                  title="开始补考"
                                >
                                  <Icon name="refresh-cw" :size="16" />
                                  <span>开始补考</span>
                                </button>
                                <button 
                                  @click="openVideoDialog(problem)" 
                                  class="btn-exam-action btn-video"
                                  title="观看讲解视频"
                                >
                                  <Icon name="play-circle" :size="16" />
                                  <span>讲解视频</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- 题库练习提示 -->
                        <div v-if="isExamExpired()" class="practice-tip-section">
                          <div class="practice-tip-content">
                            <Icon name="lightbulb" :size="24" />
                            <div class="practice-tip-text">
                              <h4>继续提升？</h4>
                              <p>前往题库进行专项练习，巩固客观题和编程题知识点！</p>
                            </div>
                            <button class="btn-go-practice" @click="goToPractice">
                              <Icon name="external-link" :size="16" />
                              前往题库
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- 普通模式界面 -->
                <template v-else>
                <!-- 任务完成提示 -->
                <div v-if="taskProgress?.task_progress?.is_completed" class="content-section completion-banner">
                  <div class="section-content">
                    <div class="completion-message">
                      <span class="completion-icon"><Icon name="sparkles" :size="64" /></span>
                      <h3>恭喜，任务已经完成！</h3>
                      <p v-if="taskProgress.task_progress.completed_at" class="completion-time">
                        完成时间: {{ formatDateTime(taskProgress.task_progress.completed_at) }}
                      </p>
                    </div>
                  </div>
                </div>


                <!-- 任务信息卡片 -->
                <div class="content-section task-info-card" v-if="selectedTask">
                  <!-- 提示横幅：只在非考试模式下显示，放在标签页内容外面 -->
                  <div v-if="!isExamMode" class="practice-tip-banner">
                    <div class="practice-tip-content">
                      <Icon name="info" :size="18" />
                      <span>先复习，再练习客观和编程题目哦！可以在右侧边栏切换到题目页面</span>
                    </div>
                  </div>
                  
                  <div class="section-content">
                      <!-- 专项复习课（视频） -->
                      <div v-if="activeTab === 'video'" class="tab-content">
                        <div v-if="selectedTask.review_video_url" class="video-section-top">
                          <div class="video-player-container">
                            <!-- 如果是直接视频文件链接，使用video标签 -->
                            <template v-if="isDirectVideoUrl(selectedTask.review_video_url)">
                              <video 
                                ref="videoPlayer"
                                :src="selectedTask.review_video_url" 
                                controls 
                                controlsList="nodownload"
                                class="embedded-video-player"
                                preload="metadata"
                                playsinline
                                @error="handleVideoError"
                                @play="videoPlaying = true"
                                @pause="videoPlaying = false"
                                @ended="videoPlaying = false"
                              >
                                <source :src="selectedTask.review_video_url" type="video/mp4">
                                <source :src="selectedTask.review_video_url" type="video/webm">
                                <source :src="selectedTask.review_video_url" type="video/ogg">
                                您的浏览器不支持视频播放
                              </video>
                              <div class="video-center-btn" :class="{ 'is-playing': videoPlaying }" @click.stop="toggleVideoPlay">
                                <Icon :name="videoPlaying ? 'pause' : 'play'" :size="48" />
                              </div>
                            </template>
                            <!-- 否则使用iframe嵌入（支持够快云盘等分享链接） -->
                            <template v-else>
                              <iframe 
                                :src="selectedTask.review_video_url"
                                class="embedded-iframe-player"
                                frameborder="0"
                                allowfullscreen
                                allow="autoplay; fullscreen; picture-in-picture"
                              ></iframe>
                            </template>
                          </div>
                          <div v-if="videoError" class="video-error">
                            <Icon name="alert-circle" :size="24" />
                            <p>视频加载失败，请尝试<a :href="selectedTask.review_video_url" target="_blank">在新窗口打开</a></p>
                          </div>
                          <a :href="selectedTask.review_video_url" target="_blank" rel="noopener noreferrer" class="btn-open-new-window-large">
                            <Icon name="external-link" :size="32" /> 新窗口打开
                          </a>
                        </div>
                        <div v-else class="empty-tab-content">
                          <Icon name="video" :size="48" />
                          <p>暂无专项复习课视频</p>
                        </div>
                      </div>

                      <!-- 知识手册 -->
                      <div v-if="activeTab === 'handbook'" class="tab-content">
                        <div v-if="selectedTask.review_content" class="review-section">
                          <!-- PDF展示 -->
                          <div v-if="selectedTask.review_content_type === 'pdf'" class="pdf-viewer-container">
                            <!-- 够快云盘链接使用iframe -->
                            <iframe 
                              v-if="isGokuaiUrl(selectedTask.review_content)"
                              :key="`gokuai-${handbookCacheKey}`"
                              :src="getGokuaiPdfUrl(selectedTask.review_content)" 
                              class="pdf-viewer pdf-viewer-iframe"
                              frameborder="0"
                            ></iframe>
                            <!-- 普通PDF使用object -->
                            <object 
                              v-else
                              :key="`pdf-${handbookCacheKey}`"
                              :data="getPdfUrl(selectedTask.review_content)" 
                              type="application/pdf"
                              class="pdf-viewer"
                            >
                              <div class="pdf-fallback">
                                <Icon name="file-text" :size="48" />
                                <p>您的浏览器不支持PDF预览，请点击下方按钮查看</p>
                              </div>
                            </object>
                            <a :href="getPdfUrl(selectedTask.review_content)" target="_blank" rel="noopener noreferrer" class="btn-open-new-window-large">
                              <Icon name="external-link" :size="32" /> 新窗口打开
                            </a>
                          </div>
                          <!-- 普通HTML内容 -->
                          <div v-else class="review-content-wrapper">
                            <div class="review-content-box" v-html="selectedTask.review_content"></div>
                            <button @click="openHandbookInNewWindow" class="btn-open-new-window-large">
                              <Icon name="external-link" :size="32" /> 新窗口打开
                            </button>
                          </div>
                        </div>
                        <div v-else class="empty-tab-content">
                          <Icon name="book-open" :size="48" />
                          <p>暂无知识手册内容</p>
                        </div>
                      </div>
                      
                      <!-- 专项练习题内容 -->
                      <div v-if="activeTab === 'exercises'" class="tab-content">
                        <div v-if="selectedTask?.exams?.length > 0" class="exercises-section">
                          <div class="section-header-inline">
                            <h4 class="section-title-inline">
                              <Icon name="file-text" :size="20" /> 专项练习题
                            </h4>
                            <!-- 规则说明 -->
                            <div class="exam-rules-info">
                              <Icon name="info" :size="18" />
                              <div class="rules-content">
                                <div class="rules-title">客观题规则</div>
                                <div class="rules-details">
                                  <span class="rule-item">每天只能提交3次</span>
                                  <span class="rule-divider">•</span>
                                  <span class="rule-item">60分以上才算通过</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="exercises-list">
                            <div 
                              v-for="exam in selectedTask.exams" 
                              :key="exam.id"
                              class="exercise-item"
                            >
                              <div class="exercise-card">
                                <div class="exercise-icon"><Icon name="file-text" :size="40" /></div>
                                <h4>{{ exam.name }}</h4>
                                <p class="exercise-desc">{{ exam.description }}</p>
                                <!-- 今天剩余提交次数 -->
                                <div class="submission-count-info" v-if="examSubmissionCounts[exam.id] !== undefined">
                                  <Icon name="clock" :size="14" />
                                  <span>今日剩余: {{ examSubmissionCounts[exam.id]?.remaining || 0 }}/3次</span>
                                </div>
                                <div class="exercise-status" :class="getExerciseStatusClass(exam)">
                                  {{ getExerciseStatusText(exam) }}
                                </div>
                                <div class="exercise-actions">
                                  <button 
                                    @click="startExam(exam)" 
                                    class="btn-start-exercise"
                                    :class="{ 'btn-frozen': examSubmissionCounts[exam.id]?.remaining === 0 }"
                                    :disabled="examSubmissionCounts[exam.id]?.remaining === 0"
                                    :title="examSubmissionCounts[exam.id]?.remaining === 0 ? '今日提交次数已用完，请明天再试' : '开始练习'"
                                  >
                                    <Icon :name="examSubmissionCounts[exam.id]?.remaining === 0 ? 'lock' : 'play'" :size="16" />
                                    <span>{{ examSubmissionCounts[exam.id]?.remaining === 0 ? '已冻结' : '开始练习' }}</span>
                                  </button>
                                  <button 
                                    @click="viewExamSubmissions(exam)" 
                                    class="btn-view-submissions"
                                    title="查看提交记录"
                                  >
                                    <Icon name="clipboard-list" :size="16" />
                                    <span>提交记录</span>
                                  </button>
                                </div>
                              </div>
                              <button 
                                @click="viewLatestSubmissionExplanation" 
                                class="btn-explanation-side"
                                title="查看最近一次提交的解析"
                              >
                                <Icon name="book-open" :size="24" />
                                <span>查看解析</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        <div v-else class="empty-tab-content">
                          <Icon name="file-text" :size="48" />
                          <p>暂无专项练习题</p>
                        </div>
                      </div>
                      
                      <!-- 编程题内容 -->
                      <div v-if="activeTab === 'programming'" class="tab-content">
                        <div v-if="selectedTask?.oj_problems?.length > 0" class="programming-section">
                          <div class="section-header-inline">
                            <h4 class="section-title-inline">
                              <Icon name="code" :size="20" /> 编程题
                            </h4>
                            <!-- 规则说明 -->
                            <div class="oj-rules-info">
                              <Icon name="info" :size="18" />
                              <div class="rules-content">
                                <div class="rules-title">编程题规则</div>
                                <div class="rules-details">
                                  <span class="rule-item">必须AC才算完成</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="programming-list">
                            <div 
                              v-for="problem in selectedTask.oj_problems.slice(0, 2)" 
                              :key="problem.id"
                              class="programming-item"
                            >
                              <div class="exercise-card">
                                <div class="exercise-icon"><Icon name="code" :size="40" /></div>
                                <h4>{{ problem.title }}</h4>
                                <div class="exercise-info">
                                 
                                </div>
                                <div class="exercise-status" :class="getExerciseStatusClass(problem)">
                                  {{ getExerciseStatusText(problem) }}
                                </div>
                                <div class="exercise-actions">
                                  <button 
                                    @click="startOJ(problem)" 
                                    class="btn-start-exercise"
                                    title="开始练习"
                                  >
                                    <Icon name="play" :size="16" />
                                    <span>开始练习</span>
                                  </button>
                                  <button 
                                    @click="viewOJSubmissions(problem)" 
                                    class="btn-view-submissions"
                                    title="查看提交记录"
                                  >
                                    <Icon name="clipboard-list" :size="16" />
                                    <span>提交记录</span>
                                  </button>
                                </div>
                              </div>
                              <button 
                                @click="openVideoDialog(problem)" 
                                class="btn-video-side"
                                title="观看讲解视频"
                              >
                                <Icon name="play-circle" :size="24" />
                                <span>讲解视频</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        <div v-else class="empty-tab-content">
                          <Icon name="code" :size="48" />
                          <p>暂无编程题</p>
                        </div>
                      </div>
                      
                      <!-- 费恩曼学习内容 -->
                      <div v-if="activeTab === 'feynman'" class="tab-content feynman-tab-content">
                        <div class="feynman-section">
                          <div class="feynman-header">
                            <Icon name="video" :size="32" />
                            <h3>费恩曼学习法</h3>
                          </div>
                          <div class="feynman-intro-content">
                            <p class="feynman-intro-text">
                              费恩曼学习法是一种高效的学习方法，由诺贝尔物理学奖得主理查德·费恩曼提出。其核心理念是：<strong>如果你不能用简单的话解释清楚，说明你还没有真正理解。</strong>
                            </p>
                            <div class="feynman-steps">
                              <h4>费恩曼学习法的四个步骤：</h4>
                              <ol class="feynman-steps-list">
                                <li>
                                  <strong>选择概念</strong>
                                  <p>选择一个你想要理解的概念或知识点，写在纸上。</p>
                                </li>
                                <li>
                                  <strong>教授他人</strong>
                                  <p>想象你要向一个完全不懂的人解释这个概念，用最简单、最直白的语言。</p>
                                </li>
                                <li>
                                  <strong>发现盲点</strong>
                                  <p>在解释过程中，你会发现哪些地方你理解得不够清楚，这些就是你的知识盲点。</p>
                                </li>
                                <li>
                                  <strong>回顾简化</strong>
                                  <p>回到原始材料，重新学习那些模糊的地方，直到能用简单的语言解释清楚。</p>
                                </li>
                              </ol>
                            </div>
                            <div class="feynman-benefits">
                              <h4>使用费恩曼学习法的好处：</h4>
                              <ul class="feynman-benefits-list">
                                <li>✅ <strong>巩固理解</strong>：通过教授他人，加深对知识的理解</li>
                                <li>✅ <strong>发现盲点</strong>：快速识别知识薄弱环节</li>
                                <li>✅ <strong>提升表达</strong>：锻炼用简单语言解释复杂概念的能力</li>
                                <li>✅ <strong>长期记忆</strong>：通过主动学习，形成更深刻的记忆</li>
                              </ul>
                            </div>
                            <div class="feynman-tip">
                              <Icon name="lightbulb" :size="20" />
                              <p><strong>小贴士：</strong>在完成每个任务后，尝试用费恩曼学习法录制你的学习总结，这将帮助你更好地掌握所学内容！</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </template>
          </div>
              </div>
            </div>
          </div>
        <div class="sidebar-placeholder-right"></div>
      </div>


      <!-- 烟花效果 -->
      <div v-if="showFireworks" class="fireworks-container">
        <div class="firework" v-for="n in 20" :key="n" :style="getFireworkStyle(n)"></div>
      </div>

      <!-- 视频弹窗 -->
      <div v-if="showVideoDialog" class="video-dialog-overlay" @click="closeVideoDialog">
        <div class="video-dialog-container" @click.stop>
          <div class="video-dialog-header">
            <h3>{{ currentVideoProblem?.title }} - 讲解视频</h3>
            <button @click="closeVideoDialog" class="video-dialog-close">
              <Icon name="x" :size="18" />
            </button>
          </div>
          <div class="video-dialog-content">
            <!-- 直接视频文件使用video标签 -->
            <video 
              v-if="isDirectVideoUrl(currentVideoProblem?.video_url)"
              :src="currentVideoProblem?.video_url" 
              controls 
              autoplay
              class="video-dialog-player"
            >
              您的浏览器不支持视频播放
            </video>
            <!-- 分享链接使用iframe嵌入 -->
            <iframe 
              v-else
              :src="currentVideoProblem?.video_url"
              class="video-dialog-iframe"
              frameborder="0"
              allowfullscreen
              allow="autoplay; fullscreen; picture-in-picture"
            ></iframe>
          </div>
        </div>
      </div>

      <!-- 查看解析弹窗 -->
      <div v-if="showExplanationDialog" class="submission-detail-modal" @click="closeExplanationDialog">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3 v-if="selectedSubmission">第 {{ selectedSubmission.attempt_number }} 次提交详情</h3>
            <h3 v-else>查看解析</h3>
            <button @click="closeExplanationDialog" class="close-btn">×</button>
          </div>
          <div class="modal-body">
            <!-- 有提交记录的情况 -->
            <template v-if="selectedSubmission">
              <div class="detail-summary">
                <div class="summary-header">
                  <div class="summary-info">
                    <h4>{{ selectedSubmission.exam_name || '专项练习题' }}</h4>
                    <p class="summary-date">{{ formatDateTime(selectedSubmission.submit_time) }}</p>
                  </div>
                  <div class="summary-actions">
                    <button 
                      @click="goToExamSubmissions(selectedSubmission.exam_id)" 
                      class="btn-go-to-submissions"
                      title="查看提交记录"
                    >
                      <Icon name="clipboard-list" :size="18" />
                      <span>查看提交记录</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="answers-section">
                <h4>答题详情</h4>
                <div v-if="loadingExplanation" class="loading-state">
                  <div class="loading-spinner"></div>
                  <p>正在加载解析...</p>
                </div>
                <div v-else class="answers-list">
                  <div 
                    v-for="(answer, index) in submissionAnswers" 
                    :key="answer.id || index"
                    class="answer-item"
                    :class="{ 'correct': answer.is_correct, 'incorrect': !answer.is_correct }"
                  >
                    <div class="answer-header">
                      <div class="question-header-left">
                        <span class="question-number">第 {{ answer.question_number || (index + 1) }} 题</span>
                        <div class="question-meta">
                          <span class="meta-tag" v-if="answer.level">等级: {{ getLevelText(answer.level) }}</span>
                          <span class="meta-tag" v-if="answer.difficulty">难度: {{ answer.difficulty }}</span>
                          <span class="meta-tag" v-if="answer.question_type">类型: {{ answer.question_type }}</span>
                        </div>
                      </div>
                      <span class="answer-status" :class="{ 'correct': answer.is_correct, 'incorrect': !answer.is_correct }">
                        {{ answer.is_correct ? '✓ 正确' : '✗ 错误' }}
                      </span>
                    </div>
                    
                    <div class="question-content">
                      <div class="question-text">{{ answer.question_text }}</div>
                      <div v-if="answer.question_code" class="question-code">
                        <pre><code>{{ answer.question_code }}</code></pre>
                      </div>
                    </div>

                    <div class="options-section">
                      <div class="options-title">选项：</div>
                      <div class="options-list">
                        <div 
                          v-for="option in (answer.options || [])" 
                          :key="option.id"
                          class="option-item"
                          :class="{
                            'user-selected': option.value === answer.user_answer,
                            'correct-option': option.value === answer.correct_answer,
                            'wrong-selected': option.value === answer.user_answer && !answer.is_correct
                          }"
                        >
                          <span class="option-label">{{ option.label }}.</span>
                          <span class="option-text">{{ option.text }}</span>
                          <span class="option-indicator">
                            <span v-if="option.value === answer.correct_answer" class="correct-mark">✓ 正确答案</span>
                            <span v-if="option.value === answer.user_answer && answer.is_correct" class="user-mark correct">您的答案</span>
                            <span v-if="option.value === answer.user_answer && !answer.is_correct" class="user-mark wrong">您的答案</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="answer-summary">
                      <div class="answer-choice">
                        <span class="choice-label">您的答案:</span>
                        <span class="choice-value" :class="{ 'correct': answer.is_correct, 'incorrect': !answer.is_correct }">
                          {{ answer.user_answer }}
                        </span>
                      </div>
                      <div class="correct-answer">
                        <span class="choice-label">正确答案:</span>
                        <span class="choice-value correct">{{ answer.correct_answer }}</span>
                      </div>
                    </div>

                    <div v-if="answer.explanation" class="explanation-section">
                      <div class="explanation-title">解析：</div>
                      <div class="explanation-text">{{ answer.explanation }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button @click="closeExplanationDialog" class="btn btn-secondary">关闭</button>
          </div>
        </div>
      </div>

      <!-- 访问被拒绝弹窗（提交记录、讲解视频和查看解析） -->
      <div v-if="showAccessDeniedDialog" class="access-denied-modal" @click="closeAccessDeniedDialog">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>暂无提交记录</h3>
            <button @click="closeAccessDeniedDialog" class="close-btn">×</button>
          </div>
          <div class="modal-body">
            <div class="access-denied-message">
              <div class="access-denied-icon">
                <Icon name="lock" :size="64" />
              </div>
              <p>您还没有提交过该题目，请先提交后再查看提交记录、讲解视频或解析。</p>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="closeAccessDeniedDialog" class="btn btn-primary">
              <Icon name="arrow-left" :size="16" />
              <span>确定</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧标签切换（固定在页面右侧） -->
      <!-- 普通模式 -->
      <div v-if="selectedTask && !isExamMode" class="task-tabs-right-fixed">
        <!-- 任务标题和描述 -->
        <div class="task-header-right">
          <h2 class="task-title-right">{{ selectedTask.name }}</h2>
          <p v-if="selectedTask.description" class="task-desc-right">{{ selectedTask.description }}</p>
        </div>
        <div class="task-tabs-right">
          <button 
            class="task-tab-right" 
            :class="{ active: activeTab === 'exercises' }"
            @click="activeTab = 'exercises'"
          >
            <Icon name="file-text" :size="32" /> 
            <span>专项练习题</span>
          </button>
          <button 
            class="task-tab-right" 
            :class="{ active: activeTab === 'programming' }"
            @click="activeTab = 'programming'"
          >
            <Icon name="code" :size="32" /> 
            <span>编程题</span>
          </button>
          <button 
            v-if="selectedTask.review_video_url"
            class="task-tab-right" 
            :class="{ active: activeTab === 'video' }"
            @click="activeTab = 'video'"
          >
            <Icon name="video" :size="32" /> 
            <span>专项复习课</span>
          </button>
          <button 
            v-if="selectedTask.review_content"
            class="task-tab-right" 
            :class="{ active: activeTab === 'handbook' }"
            @click="activeTab = 'handbook'"
          >
            <Icon name="book-open" :size="32" /> 
            <span>知识手册</span>
          </button>
          <button 
            class="task-tab-right" 
            :class="{ active: activeTab === 'feynman' }"
            @click="activeTab = 'feynman'"
          >
            <Icon name="lightbulb" :size="32" /> 
            <span>费恩曼学习</span>
          </button>
        </div>
      </div>
      
      <!-- 考试模式：显示考试成绩面板 -->
      <div v-if="selectedTask && isExamMode" class="task-tabs-right-fixed exam-mode-sidebar">
        <!-- 任务标题和描述 -->
        <div class="task-header-right">
          <h2 class="task-title-right">{{ selectedTask.name }}</h2>
          <p v-if="selectedTask.description" class="task-desc-right">{{ selectedTask.description }}</p>
        </div>
        <!-- 考试成绩面板 -->
        <div v-if="examModeScore" class="exam-score-panel-sidebar">
          <div class="score-panel-header">
            <Icon name="trophy" :size="32" />
            <h3>考试成绩</h3>
          </div>
          <div class="score-panel-body">
            <div class="total-score-display">
              <span class="total-score-value">{{ examModeScore.total }}</span>
              <span class="total-score-label">总分</span>
            </div>
            <div class="score-breakdown">
              <div class="score-item">
                <div class="score-item-header">
                  <Icon name="file-text" :size="18" />
                  <span>客观题 (50%)</span>
                </div>
                <div class="score-item-value" :class="{ 'no-submission': !examModeScore.hasExamSubmission }">
                  {{ examModeScore.hasExamSubmission ? examModeScore.examScore : '未提交' }}
                </div>
              </div>
              <div class="score-item">
                <div class="score-item-header">
                  <Icon name="code" :size="18" />
                  <span>编程题1 (25%)</span>
                </div>
                <div class="score-item-value" :class="{ 'no-submission': !examModeScore.hasOJ1Submission, 'score-perfect': examModeScore.oj1Score === 100, 'score-partial': examModeScore.oj1Score > 0 && examModeScore.oj1Score < 100 }">
                  {{ examModeScore.hasOJ1Submission ? examModeScore.oj1Score + '分' : '未提交' }}
                </div>
              </div>
              <div class="score-item">
                <div class="score-item-header">
                  <Icon name="code" :size="18" />
                  <span>编程题2 (25%)</span>
                </div>
                <div class="score-item-value" :class="{ 'no-submission': !examModeScore.hasOJ2Submission, 'score-perfect': examModeScore.oj2Score === 100, 'score-partial': examModeScore.oj2Score > 0 && examModeScore.oj2Score < 100 }">
                  {{ examModeScore.hasOJ2Submission ? examModeScore.oj2Score + '分' : '未提交' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import axios from 'axios'
  
  const router = useRouter()
const route = useRoute()
  
  import { BASE_URL, API_SERVER_BASE } from '@/config/api'
  
  const selectedLevel = ref<number | null>(null)
const selectedPlanId = ref<number | null>(null)
  const selectedTask = ref<any>(null)
  const taskProgress = ref<any>(null)
  const isExamMode = ref(false) // 考试模式标志
  
  const loading = ref(false)
  const error = ref<string | null>(null)
  const showFireworks = ref(false)
  const userInfo = ref<any>(null)
  const activeTab = ref<'video' | 'handbook' | 'exercises' | 'programming' | 'feynman'>('exercises')
  const showVideoDialog = ref(false)
  const currentVideoProblem = ref<any>(null)
  const handbookRefreshing = ref(false)
  const handbookCacheKey = ref(0) // 用于强制刷新PDF
  const videoPlayer = ref<HTMLVideoElement | null>(null)
  const videoError = ref(false)
  const videoPlaying = ref(false)
  
  // 查看解析弹窗相关状态
  const showExplanationDialog = ref(false)
  const selectedSubmission = ref<any>(null)
  const submissionAnswers = ref<any[]>([])
  const loadingExplanation = ref(false)
  const noSubmissionMessage = ref(false)
  const noSubmissionReason = ref<'none' | 'expired'>('none') // 'none': 没有提交, 'expired': 提交时间超过24小时
  
  // 存储每个考试今天的提交次数
  const examSubmissionCounts = ref<Record<number, { today_count: number; remaining: number; limit: number }>>({})
  
  // 访问被拒绝弹窗状态（用于提交记录）
  const showAccessDeniedDialog = ref(false)
  const accessDeniedReasonForSubmissions = ref<'none' | 'expired'>('none')
  
  const fetchTaskExercises = async (taskId: number) => {
    if (!userInfo.value?.id) return null
    try {
      const response = await fetch(`${BASE_URL}/learning-tasks/${taskId}/exercises?user_id=${userInfo.value.id}`)
    if (!response.ok) throw new Error(`获取任务练习失败: ${response.status}`)
      const result = await response.json()
    if (result.success) return result.data
        throw new Error(result.message || '获取任务练习失败')
    } catch (err) {
      console.error('获取任务练习失败:', err)
      error.value = err instanceof Error ? err.message : '获取任务练习失败'
      return null
    }
  }

  // 获取每个考试今天的提交次数
  const fetchExamSubmissionCounts = async () => {
    if (!userInfo.value?.id || !selectedTask.value?.id || !selectedTask.value?.exams?.length) {
      return
    }
    
    const taskId = selectedTask.value.id
    const counts: Record<number, { today_count: number; remaining: number; limit: number }> = {}
    
    for (const exam of selectedTask.value.exams) {
      try {
        const response = await fetch(
          `${BASE_URL}/learning-tasks/${taskId}/exam-submission-count?user_id=${userInfo.value.id}&exam_id=${exam.id}`
        )
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            counts[exam.id] = result.data
          }
        }
      } catch (error) {
        console.error(`获取考试 ${exam.id} 的提交次数失败:`, error)
      }
    }
    
    examSubmissionCounts.value = counts
  }

  const fetchTaskProgress = async (taskId: number) => {
    if (!userInfo.value?.id) {
      console.warn('用户信息不存在，无法获取任务进度')
      return null
    }
    try {
      const response = await fetch(`${BASE_URL}/learning-tasks/${taskId}/progress?user_id=${userInfo.value.id}`)
      if (!response.ok) {
        throw new Error(`获取任务进度失败: ${response.status}`)
      }
      const result = await response.json()
      if (result.success && result.data) {
        console.log('任务进度数据:', result.data)
        return result.data
      }
      throw new Error(result.message || '获取任务进度失败')
    } catch (err) {
      console.error('获取任务进度失败:', err)
      error.value = err instanceof Error ? err.message : '获取任务进度失败'
      return null
    }
  }
  
  const getExamProgressPercent = () => {
    if (!taskProgress.value?.exam_progress) return 0
    const total = taskProgress.value.exam_progress.total ?? 0
    const completed = taskProgress.value.exam_progress.completed ?? 0
    if (total === 0) return 0
    return Math.round((completed / total) * 100)
  }

  // 计算OJ题目分数（根据通过率）
  const getOJScore = (problem: any) => {
    if (!problem || !problem.best_verdict) return 0
    if (problem.best_verdict === 'Accepted') return 100
    // PAC (Partial Accepted) - 使用 best_pass_rate 字段
    if (problem.best_pass_rate !== undefined && problem.best_pass_rate !== null) {
      return Math.round(Number(problem.best_pass_rate)) || 0
    }
    return 0
  }

  // 计算考试模式总分
  const getExamModeScore = () => {
    if (!selectedTask.value || !isExamMode.value) return null
    
    const exams = selectedTask.value.exams || []
    const ojProblems = selectedTask.value.oj_problems || []
    
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

  // 计算属性：考试成绩（用于模板中安全访问）
  const examModeScore = computed(() => getExamModeScore())

  const getOJProgressPercent = () => {
    if (!taskProgress.value?.oj_progress) return 0
    const total = taskProgress.value.oj_progress.total ?? 0
    const completed = taskProgress.value.oj_progress.completed ?? 0
    if (total === 0) return 0
    return Math.round((completed / total) * 100)
  }

  const getExerciseStatusClass = (exercise: any) => {
    return exercise.is_completed === true || exercise.is_completed === 1 || exercise.is_completed === '1' ? 'status-completed' : 'status-pending'
  }
  const getExerciseStatusText = (exercise: any) => {
    return exercise.is_completed === true || exercise.is_completed === 1 || exercise.is_completed === '1' ? '已完成' : '未完成'
  }
  const getDifficultyText = (difficulty: string) => {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
    return map[difficulty] || difficulty
  }

  // 判断考试是否已过期（根据任务结束时间）
  const isExamExpired = () => {
    if (!selectedTask.value?.end_time) return false
    const endTime = new Date(selectedTask.value.end_time)
    return new Date() > endTime
  }

  // 当前任务的结束时间（格式化用于展示）
  const taskEndTimeFormatted = computed(() => {
    const t = selectedTask.value?.end_time
    if (!t) return ''
    const date = new Date(t)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  })

  const startExam = (exam: any) => {
    // 构建URL参数，只传递有效的值
    const params = new URLSearchParams()
    params.set('from', 'taskview')
    if (selectedPlanId.value) {
      params.set('planId', selectedPlanId.value.toString())
    }
    if (selectedTask.value?.id) {
      params.set('taskId', selectedTask.value.id.toString())
    }
    // 从任务页面进入，使用任务内考试页面
    router.push(`/plan-exam/${exam.id}?${params.toString()}`)
  }
  const startOJ = (problem: any) => {
    // 构建URL参数，只传递有效的值
    const params = new URLSearchParams()
    params.set('from', 'taskview')
    if (selectedPlanId.value) {
      params.set('planId', selectedPlanId.value.toString())
    }
    if (selectedTask.value?.id) {
      params.set('taskId', selectedTask.value.id.toString())
    }
    // 从任务页面进入，使用任务内编程题页面
    router.push(`/plan-smartoj/${problem.id}?${params.toString()}`)
  }

// 查看专项练习题提交记录
const viewExamSubmissions = async (exam: any) => {
  if (!userInfo.value?.id) {
    alert('请先登录')
    return
  }
  
  // 先检查是否有近1天的提交记录
  try {
    const response = await axios.get(`${BASE_URL}/submissions`, {
      params: {
        user_id: userInfo.value.id,
        exam_id: exam.id
      }
    })
    
    const submissions = Array.isArray(response.data) ? response.data : []
    
    if (submissions.length === 0) {
      accessDeniedReasonForSubmissions.value = 'none'
      showAccessDeniedDialog.value = true
      return
    }
    
    // 开放全部提交，无24小时限制，直接进入提交记录页
    const params = new URLSearchParams()
    params.set('from', 'taskview')
    if (selectedPlanId.value) {
      params.set('planId', selectedPlanId.value.toString())
    }
    if (selectedTask.value?.id) {
      params.set('taskId', selectedTask.value.id.toString())
    }
    router.push(`/exam-submissions/${exam.id}?${params.toString()}`)
  } catch (error: any) {
    console.error('检查提交记录失败:', error)
    accessDeniedReasonForSubmissions.value = 'none'
    showAccessDeniedDialog.value = true
  }
}

// 查看编程题提交记录
const viewOJSubmissions = async (problem: any) => {
  if (!userInfo.value?.id) {
    alert('请先登录')
    return
  }
  
  // 先检查是否有近1天的OJ提交记录
  try {
    const response = await axios.get(`${BASE_URL}/oj/submissions`, {
      params: {
        userId: userInfo.value.id,
        problemId: problem.id,
        page: 1,
        pageSize: 100
      }
    })
    
    const submissions = response.data?.data || []
    
    if (submissions.length === 0) {
      accessDeniedReasonForSubmissions.value = 'none'
      showAccessDeniedDialog.value = true
      return
    }
    
    // 开放全部提交，无24小时限制，直接进入提交记录页
    const params = new URLSearchParams()
    params.set('from', 'taskview')
    if (selectedPlanId.value) {
      params.set('planId', selectedPlanId.value.toString())
    }
    if (selectedTask.value?.id) {
      params.set('taskId', selectedTask.value.id.toString())
    }
    router.push(`/oj-submissions/${problem.id}?${params.toString()}`)
  } catch (error: any) {
    console.error('检查提交记录失败:', error)
    accessDeniedReasonForSubmissions.value = 'none'
    showAccessDeniedDialog.value = true
  }
}

// 打开视频弹窗
const openVideoDialog = async (problem: any) => {
  if (!userInfo.value?.id) {
    alert('请先登录')
    return
  }
  
  // 先检查是否有近1天的OJ提交记录
  try {
    const response = await axios.get(`${BASE_URL}/oj/submissions`, {
      params: {
        userId: userInfo.value.id,
        problemId: problem.id,
        page: 1,
        pageSize: 100
      }
    })
    
    const submissions = response.data?.data || []
    
    if (submissions.length === 0) {
      accessDeniedReasonForSubmissions.value = 'none'
      showAccessDeniedDialog.value = true
      return
    }
    
    // 开放全部提交，无24小时限制，有提交即可查看视频
    const videoResponse = await fetch(`${BASE_URL}/oj/problems/${problem.id}/video`)
    const videoResult = await videoResponse.json()
    if (videoResult.success && videoResult.data.video_url) {
      currentVideoProblem.value = {
        ...problem,
        video_url: videoResult.data.video_url
      }
      showVideoDialog.value = true
    } else {
      alert('该题目暂无讲解视频')
    }
  } catch (err: any) {
    console.error('检查提交记录或获取视频链接失败:', err)
    accessDeniedReasonForSubmissions.value = 'none'
    showAccessDeniedDialog.value = true
  }
}

// 关闭视频弹窗
const closeVideoDialog = () => {
  showVideoDialog.value = false
  currentVideoProblem.value = null
}

// 查看最近一次提交的解析
const viewLatestSubmissionExplanation = async () => {
  if (!userInfo.value?.id || !selectedTask.value?.exams?.length) {
    alert('无法获取用户信息或任务信息')
    return
  }
  
  loadingExplanation.value = true
  
  try {
    // 获取所有专项练习题的提交记录
    const allSubmissions: any[] = []
    
    for (const exam of selectedTask.value.exams) {
      try {
        const response = await axios.get(`${BASE_URL}/submissions`, {
          params: {
            user_id: userInfo.value.id,
            exam_id: exam.id
          }
        })
        
        if (Array.isArray(response.data) && response.data.length > 0) {
          allSubmissions.push(...response.data)
        }
      } catch (error) {
        console.error(`获取考试 ${exam.id} 的提交记录失败:`, error)
      }
    }
    
    // 如果没有提交记录
    if (allSubmissions.length === 0) {
      accessDeniedReasonForSubmissions.value = 'none'
      showAccessDeniedDialog.value = true
      loadingExplanation.value = false
      return
    }
    
    // 按提交时间排序，取最近一次；开放全部提交，无24小时限制
    allSubmissions.sort((a: any, b: any) => {
      const timeA = new Date(a.submit_time).getTime()
      const timeB = new Date(b.submit_time).getTime()
      return timeB - timeA
    })
    
    const latestSubmission = allSubmissions[0]
    selectedSubmission.value = latestSubmission
    
    // 获取提交详情
    await fetchSubmissionDetail(latestSubmission.id)
    showExplanationDialog.value = true
  } catch (error: any) {
    console.error('获取提交记录失败:', error)
    accessDeniedReasonForSubmissions.value = 'none'
    showAccessDeniedDialog.value = true
  } finally {
    loadingExplanation.value = false
  }
}

// 获取提交详情
const fetchSubmissionDetail = async (submissionId: number) => {
  try {
    const response = await axios.get(`${BASE_URL}/submissions/${submissionId}`)
    const answers = response.data.answers || []
    // 按题目序号排序
    submissionAnswers.value = answers.sort((a: any, b: any) => {
      const numA = a.question_number || 0
      const numB = b.question_number || 0
      return numA - numB
    })
  } catch (error: any) {
    console.error('获取提交详情失败:', error)
    alert('获取提交详情失败: ' + (error.response?.data?.error || error.message))
  }
}

// 关闭解析弹窗
const closeExplanationDialog = () => {
  showExplanationDialog.value = false
  selectedSubmission.value = null
  submissionAnswers.value = []
  noSubmissionMessage.value = false
  noSubmissionReason.value = 'none'
}

// 关闭访问被拒绝弹窗
const closeAccessDeniedDialog = () => {
  showAccessDeniedDialog.value = false
  accessDeniedReasonForSubmissions.value = 'none'
}

// 跳转到客观试卷的提交记录页面
const goToExamSubmissions = (examId: number) => {
  if (!examId) return
  
  // 构建URL参数
  const params = new URLSearchParams()
  params.set('from', 'taskview')
  if (selectedPlanId.value) {
    params.set('planId', selectedPlanId.value.toString())
  }
  if (selectedTask.value?.id) {
    params.set('taskId', selectedTask.value.id.toString())
  }
  
  // 关闭弹窗并跳转
  closeExplanationDialog()
  router.push(`/exam-submissions/${examId}?${params.toString()}`)
}

// 等级文本
const getLevelText = (level: number) => {
  return `GESP ${level}级`
}

// 获取分数等级
const getScoreClass = (score: number) => {
  if (score >= 90) return 'excellent'
  if (score >= 80) return 'good'
  if (score >= 60) return 'pass'
  return 'fail'
}

// 获取分数文本
const getScoreText = (score: number) => {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 60) return '及格'
  return '不及格'
}

const backToTasks = () => {
  router.push(`/plan/${selectedPlanId.value}/tasks`)
}

// 前往题库练习
const goToPractice = () => {
  router.push(`/select-level`)
}

const formatDateTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

// 判断是否为够快云盘链接
const isGokuaiUrl = (url: string) => {
  if (!url) return false
  return url.includes('gokuai.com') || url.includes('gokuai.cn')
}

// 获取够快云盘PDF的嵌入URL
const getGokuaiPdfUrl = (url: string) => {
  if (!url) return ''
  // 够快云盘的分享链接需要转换为预览链接
  // 格式: https://yk3.gokuai.com/file/xxx# -> https://yk3.gokuai.com/file/xxx?view=1
  let pdfUrl = url
  // 移除末尾的 # 号
  if (pdfUrl.endsWith('#')) {
    pdfUrl = pdfUrl.slice(0, -1)
  }
  // 添加预览参数
  const separator = pdfUrl.includes('?') ? '&' : '?'
  pdfUrl = `${pdfUrl}${separator}view=1`
  // 强制刷新时添加时间戳参数
  if (handbookCacheKey.value > 0) {
    pdfUrl = `${pdfUrl}&_t=${handbookCacheKey.value || Date.now()}`
  }
  return pdfUrl
}

// 获取PDF完整URL（支持缓存控制）
const getPdfUrl = (path: string, forceRefresh = false) => {
  if (!path) return ''
  let url = path
  // 如果是够快云盘链接，返回原始链接（用于下载和新窗口打开）
  if (isGokuaiUrl(path)) {
    // 移除末尾的 # 号
    if (url.endsWith('#')) {
      url = url.slice(0, -1)
    }
    return url
  }
  // 如果不是完整URL，拼接API_SERVER_BASE
  if (!path.startsWith('http://') && !path.startsWith('https://')) {
    url = `${API_SERVER_BASE}${path}`
  }
  // 强制刷新时添加时间戳参数
  if (forceRefresh || handbookCacheKey.value > 0) {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}_t=${handbookCacheKey.value || Date.now()}`
  }
  return url
}

// 视频加载错误处理
const handleVideoError = () => {
  videoError.value = true
}

// 判断是否为直接视频文件URL
const isDirectVideoUrl = (url: string) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
  const lowerUrl = url.toLowerCase().split('?')[0] // 去掉查询参数
  return videoExtensions.some(ext => lowerUrl.endsWith(ext))
}

// 切换视频播放/暂停
const toggleVideoPlay = () => {
  if (!videoPlayer.value) return
  if (videoPlayer.value.paused) {
    videoPlayer.value.play()
  } else {
    videoPlayer.value.pause()
  }
}

// 刷新知识手册
const refreshHandbook = async () => {
  handbookRefreshing.value = true
  try {
    // 更新缓存key，强制重新加载
    handbookCacheKey.value = Date.now()
    
    // 如果是文本内容，重新获取任务数据
    if (selectedTask.value?.review_content_type !== 'pdf') {
      const taskId = Number(route.params.taskId)
      const taskData = await fetchTaskExercises(taskId)
      if (taskData?.task) {
        selectedTask.value.review_content = taskData.task.review_content ?? ''
        selectedTask.value.review_content_type = taskData.task.review_content_type || 'text'
      }
    }
  } finally {
    handbookRefreshing.value = false
  }
}

// 触发烟花效果
const triggerFireworks = () => {
  showFireworks.value = true
  // 15秒后自动关闭烟花效果
  setTimeout(() => {
    showFireworks.value = false
  }, 15000)
}

// 生成烟花样式
const getFireworkStyle = (index: number) => {
  const angle = (360 / 20) * index
  const distance = 200 + Math.random() * 100
  const x = Math.cos((angle * Math.PI) / 180) * distance
  const y = Math.sin((angle * Math.PI) / 180) * distance
  const delay = Math.random() * 0.5
  const duration = 1 + Math.random() * 0.5
  
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
  }
}

// 在新窗口打开知识手册
const openHandbookInNewWindow = () => {
  if (!selectedTask.value?.review_content) return
  
  // 创建新窗口并显示HTML内容
  const newWindow = window.open('', '_blank')
  if (!newWindow) {
    alert('无法打开新窗口，请检查浏览器弹窗设置')
    return
  }
  
  const htmlContent = `
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${selectedTask.value.name} - 知识手册</title>
  <style>
    body { 
      font-family: '微软雅黑', 'Microsoft YaHei', 'PingFang SC', sans-serif; 
      line-height: 1.8; 
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f8fafc;
      color: #1e293b;
    }
    h1, h2, h3, h4 { color: #1e293b; margin-top: 24px; margin-bottom: 12px; }
    h1 { font-size: 2rem; border-bottom: 3px solid #1e90ff; padding-bottom: 12px; }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.3rem; }
    p { margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ccc; padding: 12px; text-align: left; }
    th { background: #e0f2fe; font-weight: 600; }
    ul, ol { margin: 12px 0; padding-left: 24px; }
    li { margin: 6px 0; }
    strong { color: #1e293b; font-weight: 700; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <h1>${selectedTask.value.name} - 知识手册</h1>
  ${selectedTask.value.review_content}
</body>
</html>`
  
  newWindow.document.write(htmlContent)
  newWindow.document.close()
}

// 下载知识手册为docx（使用Word兼容的HTML格式）
const downloadHandbook = () => {
  if (!selectedTask.value?.review_content) return
  
  // 创建Word兼容的HTML文档
  const htmlContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: '微软雅黑', 'Microsoft YaHei', sans-serif; line-height: 1.8; }
    h1, h2, h3, h4 { color: #1e293b; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px; }
  </style>
</head>
<body>
  <h1>${selectedTask.value.name}</h1>
  ${selectedTask.value.review_content}
</body>
</html>`
  
  // 创建Blob并下载为.doc文件（Word可直接打开）
  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${selectedTask.value.name}-知识手册.doc`
  a.click()
  URL.revokeObjectURL(url)
}

  const testAPIConnection = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`${BASE_URL}/health`, { method: 'GET', signal: controller.signal })
      clearTimeout(timeoutId)
      return response.ok
    } catch (err) {
      console.error('API连接测试失败:', err)
      return false
    }
  }
  
  onMounted(async () => {
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // 检查 URL 参数中的 tab 参数，设置对应的标签页
    const urlParams = new URLSearchParams(window.location.search)
    const tab = urlParams.get('tab')
    if (tab === 'video') {
      activeTab.value = 'video'
    } else if (tab === 'handbook') {
      activeTab.value = 'handbook'
    } else if (tab === 'exercises') {
      activeTab.value = 'exercises'
    } else if (tab === 'programming') {
      activeTab.value = 'programming'
    } else if (tab === 'feynman') {
      activeTab.value = 'feynman'
    } else {
      activeTab.value = 'exercises' // 默认显示专项练习题
    }
    
    const userInfoStr = localStorage.getItem('userInfo')
  if (!userInfoStr) { error.value = '请先登录'; return }
      userInfo.value = JSON.parse(userInfoStr)
      
      const isConnected = await testAPIConnection()
  if (!isConnected) { error.value = '无法连接到服务器，请检查网络连接或联系管理员'; return }

  const planId = Number(route.params.planId)
  const taskId = Number(route.params.taskId)
  if (!planId || !taskId) { error.value = '缺少计划或任务ID'; return }
  selectedPlanId.value = planId

  loading.value = true
  const [taskData, progressData] = await Promise.all([
    fetchTaskExercises(taskId),
    fetchTaskProgress(taskId)
  ])
  loading.value = false
  if (taskData) {
    console.log('接口返回复习内容 review_content:', taskData.task?.review_content)
    console.log('接口返回复习视频 review_video_url:', taskData.task?.review_video_url)
    
    // 去重函数：基于 id 去重，保留第一个出现的
    const deduplicateById = (items: any[]) => {
      if (!items || items.length === 0) return []
      const seen = new Map()
      return items.filter((item: any) => {
        if (!item || !item.id) return false
        if (seen.has(item.id)) return false
        seen.set(item.id, true)
        return true
      })
    }
    
    // 对 exams 和 oj_problems 进行去重
    const uniqueExams = deduplicateById(taskData.exams || [])
    const uniqueOJProblems = deduplicateById(taskData.oj_problems || [])
    
    selectedTask.value = {
      ...(taskData.task || {}),
      review_content: taskData.task?.review_content ?? '',
      review_content_type: taskData.task?.review_content_type || 'text',
      review_video_url: taskData.task?.review_video_url ?? '',
      exams: uniqueExams,
      oj_problems: uniqueOJProblems
    }
    
    // 获取每个考试今天的提交次数（需要在设置 selectedTask.value 之后）
    await fetchExamSubmissionCounts()
    
    // 设置考试模式
    isExamMode.value = taskData.task?.is_exam_mode === true || taskData.task?.is_exam_mode === 1 || taskData.task?.is_exam_mode === '1'
    console.log('📋 [TaskView] 任务数据:', taskData.task)
    console.log('🎯 [TaskView] is_exam_mode 原始值:', taskData.task?.is_exam_mode)
    console.log('🎯 [TaskView] isExamMode 计算结果:', isExamMode.value)
    console.log('TaskView 合并后的selectedTask:', selectedTask.value)
    console.log('TaskView review_content:', selectedTask.value.review_content)
    console.log('TaskView review_video_url:', selectedTask.value.review_video_url)
    selectedLevel.value = taskData.task?.level ?? null
    
    // 设置默认标签为第一个可用的标签（如果URL没有指定）
    const urlParams2 = new URLSearchParams(window.location.search)
    if (!urlParams2.get('tab')) {
      if (selectedTask.value.review_video_url) {
        activeTab.value = 'video'
      } else if (selectedTask.value.review_content) {
        activeTab.value = 'handbook'
      } else {
        activeTab.value = 'exercises'
      }
    }
    
    // 更新任务进度信息
    if (progressData) {
      taskProgress.value = progressData
      console.log('任务进度信息已更新:', taskProgress.value)
      
      // 更新客观题完成状态和进度信息
      if (selectedTask.value.exams && progressData.exam_progress?.exams) {
        selectedTask.value.exams = selectedTask.value.exams.map((exam: any) => {
          const progressExam = progressData.exam_progress.exams.find((e: any) => e.id === exam.id)
          if (progressExam) {
            return {
              ...exam,
              is_completed: progressExam.is_completed === '1' || progressExam.is_completed === 1 || progressExam.is_completed === true,
              best_score: progressExam.best_score,
              attempt_count: progressExam.attempt_count
            }
          }
          return exam
        })
      }
      
      // 更新OJ题完成状态和进度信息
      if (selectedTask.value.oj_problems && progressData.oj_progress?.problems) {
        console.log('📊 [TaskView] OJ进度原始数据:', progressData.oj_progress.problems)
        selectedTask.value.oj_problems = selectedTask.value.oj_problems.map((problem: any) => {
          const progressProblem = progressData.oj_progress.problems.find((p: any) => p.id === problem.id)
          if (progressProblem) {
            console.log(`📊 [TaskView] OJ题目 ${problem.id} 进度:`, {
              best_verdict: progressProblem.best_verdict,
              best_pass_rate: progressProblem.best_pass_rate,
              is_completed: progressProblem.is_completed
            })
            return {
              ...problem,
              is_completed: progressProblem.is_completed === '1' || progressProblem.is_completed === 1 || progressProblem.is_completed === true,
              best_verdict: progressProblem.best_verdict,
              best_pass_rate: progressProblem.best_pass_rate,
              attempt_count: progressProblem.attempt_count
            }
          }
          return problem
        })
      }
      
      // 如果任务完成，触发烟花特效
      if (taskProgress.value?.task_progress?.is_completed) {
        triggerFireworks()
      }
    } else {
      console.warn('未获取到任务进度数据')
    }
    }
  })

// 监听任务完成状态，当从未完成变为完成时触发烟花
watch(() => taskProgress.value?.task_progress?.is_completed, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    triggerFireworks()
  }
})
  </script>
  
  <style scoped>
/* 基础布局 */
.exam-layout {
  min-height: 100vh;
  width: 100vw;
  background: #87CEEB; /* 天蓝色 */
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
  padding: 0 20px 20px 20px;
  box-sizing: border-box;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: center;
  margin-top: 0;
}

/* 底部固定计划头部 */
.plan-header-fixed {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 24px;
  border-top: 2px solid #e2e8f0;
  position: fixed;
  bottom: 0; /* 固定在底部 */
  left: 0;
  right: 0;
  z-index: 999;
  backdrop-filter: blur(10px);
  background: rgba(135, 206, 235, 0.95); /* 天蓝色 */
  width: 100%;
  gap: 2px;
  box-sizing: border-box;
}

.plan-header-inner {
  width: 100%;
  max-width: 1600px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  position: relative;
  gap: 16px;
  min-height: 54px; /* 足够容纳按钮和较大标题 */
}

/* 任务完成进度在 header 中的样式 */
.plan-progress-in-header {
  width: 100%;
  max-width: 1600px;
  padding: 12px 24px;
  margin-top: 8px;
}

.progress-row-container {
  display: flex;
  gap: 24px;
  width: 100%;
}

.progress-item-header {
  flex: 1;
  min-width: 0;
}

.progress-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.progress-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e293b; /* 黑色 */
}

.progress-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
}

.progress-bar-container-header {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill-header {
  height: 100%;
  background: linear-gradient(90deg, #1e90ff 0%, #38bdf8 100%);
  border-radius: 8px;
  transition: width 0.5s ease-in-out;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.4);
}

.plan-header-title {
  position: absolute;
  left: 0; right: 0;
  margin: 0 auto;
  text-align: center;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, #0ea5e9 0%, #1e90ff 40%, #60a5fa 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  padding: 4px 12px;
  border-radius: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 6px 24px rgba(30, 144, 255, 0.18), inset 0 1px 0 rgba(255,255,255,0.6);
  max-width: 65%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
}

.plan-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  position: static;
  margin-right: 12px;
}

.plan-header-underline {
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #1e90ff 40%, #38bdf8 60%, transparent 100%);
  margin-top: 4px;
  border-radius: 2px;
  opacity: 0.6;
  width: 100%;
  max-width: 1600px;
}

.sidebar-placeholder-left { 
  width: 50px; 
  flex-shrink: 0; 
}
.sidebar-placeholder-right { width: 50px; flex-shrink: 0; }

/* 左侧返回按钮样式 - 固定定位 */
.back-nav-arrow {
  position: fixed;
  left: 20px;
  top: 80px;
  background: rgba(30, 144, 255, 0.15);
  backdrop-filter: blur(10px);
  color: #1e90ff;
  border: 2px solid rgba(30, 144, 255, 0.3);
  border-radius: 12px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.2);
  z-index: 100;
}

.back-nav-arrow:hover {
  background: rgba(30, 144, 255, 0.2);
  border-color: rgba(30, 144, 255, 0.5);
  color: #0c7cd5;
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
}

.back-nav-arrow:active {
  transform: scale(0.95);
}

.back-nav-arrow :deep(.lucide-icon) {
  flex-shrink: 0;
}
.question-main { flex: 1; max-width: 1600px; min-width: 0; }
.question-card { 
  background: #f8fafc; 
  border: 1.5px solid #e2e8f0; 
  border-radius: 18px; 
  box-shadow: 0 6px 24px -4px rgba(30, 144, 255, 0.1); 
  transition: all 0.3s ease; 
  padding: 0; 
  overflow: visible; 
  width: 100%; 
  min-height: calc(100vh - 84px - 80px); /* 最小高度，减去顶部空间和底部 header 高度 */
  display: flex; 
  flex-direction: column; 
  margin: 20px auto 0 auto; /* 减少上边距，让卡片上移 */
  box-sizing: border-box; 
}

/* 任务视图时，卡片背景透明融入页面背景 */
.question-card.task-view-transparent {
  background: transparent;
  border: none;
  box-shadow: none;
}

.question-card.task-view-transparent .question-card-header {
  display: none; /* 任务视图时隐藏 header */
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
.header-left-section { display: flex; align-items: center; gap: 12px; min-width: 150px; }
.header-center-section { display: flex; align-items: center; gap: 12px; flex: 1; justify-content: center; }
.header-right-section { display: flex; align-items: center; gap: 12px; min-width: 150px; justify-content: flex-end; }
.number-badge { background: rgba(255, 255, 255, 0.2); color: white; padding: 10px 20px; border-radius: 24px; font-weight: 700; font-size: 1.1rem; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2); }
.level-badge { background: rgba(255, 255, 255, 0.15); color: white; padding: 8px 14px; border-radius: 18px; font-weight: 600; font-size: 0.95rem; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
.question-content-unified { flex: 1; display: flex; flex-direction: row; overflow: visible; background: transparent; /* 透明背景，融入页面背景 */ }
.question-left-panel { flex: 1; overflow: visible; padding: 24px; display: flex; flex-direction: column; gap: 24px; background: transparent; /* 透明背景，融入页面背景 */ }
.question-left-panel-centered { max-width: 1600px; margin: 0 auto; width: 100%; }
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
.section-header { background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%); padding: 24px 32px; border-bottom: 4px solid #0c7cd5; border-radius: 20px 20px 0 0; position: relative; }
.section-title { margin: 0; color: white; font-size: 1.8rem; font-weight: 900; display: flex; align-items: center; gap: 12px; text-shadow: 0 3px 6px rgba(0, 0, 0, 0.3); letter-spacing: 1px; }
.section-title :deep(.lucide-icon) { color: white; width: 32px; height: 32px; }
.section-content { padding: 8px; background: transparent; }
/* LevelExamsView风格统一返回按钮样式 */
.back-btn {
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  border: none;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 10px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(30,144,255,0.2);
  display: flex;
  align-items: center;
  gap: 6px;
}
.back-btn:hover {
  background: linear-gradient(135deg, #38bdf8 0%, #1e90ff 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(30,144,255,0.3);
}
.empty-state { text-align: center; padding: 80px 32px; }
.empty-icon { font-size: 6rem; margin-bottom: 24px; }
.empty-state h3 { color: #01579b; font-size: 2rem; margin: 0 0 16px 0; font-weight: 900; letter-spacing: 1px; }
.empty-state p { color: #0277bd; font-size: 1.3rem; font-weight: 600; }
.error-state { text-align: center; padding: 80px 32px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 6px solid #ef4444; border-radius: 24px; }
.error-icon { font-size: 6rem; margin-bottom: 24px; }
.error-state h3 { color: #dc2626; font-size: 2rem; margin: 0 0 16px 0; font-weight: 900; letter-spacing: 1px; }
.error-state p { color: #991b1b; font-size: 1.3rem; margin-bottom: 24px; font-weight: 600; }
.retry-btn { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; border: 5px solid #b91c1c; padding: 16px 32px; border-radius: 16px; font-size: 1.2rem; font-weight: 900; cursor: pointer; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 10px; letter-spacing: 0.5px; box-shadow: 0 4px 16px rgba(220, 38, 38, 0.3); }
.retry-btn:hover { background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); transform: translateY(-2px) scale(1.05); box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4); border-width: 6px; }
.loading-state { text-align: center; padding: 80px 32px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 6px solid #1e90ff; border-radius: 24px; }
.loading-icon { font-size: 6rem; margin-bottom: 24px; display: flex; justify-content: center; align-items: center; color: #1e90ff; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.task-info-card { 
  margin-bottom: 32px; 
  background: linear-gradient(135deg, #e0f7fa 0%, #b3e5fc 100%) !important; /* 与费恩曼学习法相同的渐变色 */
  border: 6px solid #0288d1 !important;
  border-radius: 24px !important;
  box-shadow: 0 12px 40px rgba(2, 136, 209, 0.3) !important;
}
.task-info-card h2 { color: #01579b; font-size: 2rem; margin: 0 0 16px 0; font-weight: 900; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
.task-info-desc { color: #0277bd; font-size: 1.2rem; margin: 0 0 24px 0; line-height: 1.8; font-weight: 600; }

/* 标签切换容器（已移除，保留样式以防其他地方使用） */
.task-tabs-container {
  margin-top: 24px;
}

.task-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0;
}

.task-tab {
  background: transparent;
  border: none;
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  position: relative;
}

.task-tab:hover {
  color: #1e90ff;
  background: rgba(30, 144, 255, 0.05);
}

.task-tab.active {
  color: #1e90ff;
  border-bottom-color: #1e90ff;
  background: rgba(30, 144, 255, 0.08);
}

.task-tab :deep(.lucide-icon) {
  color: inherit;
}

/* 右侧固定标签切换 - 低幼化风格 */
.task-tabs-right-fixed {
  position: fixed;
  top: 48px; /* 从导航栏下方开始，导航栏高度为48px */
  right: 0;
  bottom: 0;
  width: 260px; /* 从320px减小到260px，让内容区更大 */
  z-index: 999; /* 低于导航栏的z-index: 1000 */
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  border-left: 6px solid #0c7cd5;
  box-shadow: -12px 0 40px rgba(30, 144, 255, 0.4);
  padding: 20px 14px; /* 相应减小内边距 */
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

/* 右侧任务标题和描述 */
.task-header-right {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 3px solid rgba(255, 255, 255, 0.3);
}

.task-title-right {
  margin: 0 0 8px 0;
  font-size: 1.8rem;
  font-weight: 900;
  color: white;
  text-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
  line-height: 1.3;
  word-break: break-word;
}

.task-desc-right {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  line-height: 1.5;
  word-break: break-word;
}

.task-tabs-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.task-tab-right {
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
  overflow: hidden;
}

.task-tab-right::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(30, 144, 255, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.task-tab-right:hover {
  transform: translateX(-4px) scale(1.05);
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.5);
  border-color: #fff;
  background: #fff;
  animation: bounceRight 0.5s ease;
}

@keyframes bounceRight {
  0%, 100% {
    transform: translateX(-4px) scale(1.05);
  }
  50% {
    transform: translateX(-6px) scale(1.07);
  }
}

.task-tab-right:hover::before {
  opacity: 1;
}

.task-tab-right.active {
  background: linear-gradient(135deg, #fff 0%, #e0f2fe 100%);
  border-color: #1e90ff;
  border-width: 6px;
  color: #1e90ff;
  box-shadow: 0 12px 40px rgba(30, 144, 255, 0.6);
  transform: translateX(-3px) scale(1.03);
  animation: pulseRight 2s ease-in-out infinite;
}

@keyframes pulseRight {
  0%, 100% {
    box-shadow: 0 12px 40px rgba(30, 144, 255, 0.6);
  }
  50% {
    box-shadow: 0 12px 50px rgba(30, 144, 255, 0.8);
  }
}

.task-tab-right.active::before {
  opacity: 1;
  background: linear-gradient(135deg, rgba(30, 144, 255, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%);
}

.task-tab-right :deep(.lucide-icon) {
  color: inherit;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.task-tab-right span {
  font-size: 1.6rem;
  font-weight: 900;
  letter-spacing: 1px;
  line-height: 1.2;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.task-tab-right.active span {
  color: #1e90ff;
  text-shadow: 0 3px 6px rgba(30, 144, 255, 0.3);
}

.task-tab-right:active {
  transform: translateX(-2px) scale(1.01);
}

/* 为右侧标签预留空间，避免内容被遮挡 */
.question-left-panel {
  padding-right: 280px; /* 为右侧标签（包含标题和描述）预留空间，从340px减小到280px */
}

/* 标签内容区域 */
.tab-content {
  min-height: 200px;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 空状态 */
.empty-tab-content {
  text-align: center;
  padding: 80px 32px;
  color: #0277bd;
}

.empty-tab-content :deep(.lucide-icon) {
  color: #1e90ff;
  margin-bottom: 24px;
  width: 80px;
  height: 80px;
}

.empty-tab-content p {
  font-size: 1.4rem;
  margin: 0;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* 内联标题样式 */
.section-header-inline {
  margin-bottom: 28px;
  padding-bottom: 16px;
  border-bottom: 4px solid #1e90ff;
}

.section-title-inline {
  margin: 0;
  color: #01579b;
  font-size: 1.8rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 12px;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section-title-inline :deep(.lucide-icon) {
  color: #1e90ff;
  width: 32px;
  height: 32px;
}

/* 练习提示横幅 */
.practice-tip-banner {
  margin: 20px 20px 0 20px;
  padding: 0;
}

.practice-tip-content {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fbbf24;
  border-radius: 12px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
  color: #92400e;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
}

.practice-tip-content :deep(.lucide-icon) {
  flex-shrink: 0;
  color: #d97706;
}

.practice-tip-content span {
  flex: 1;
}

/* 练习题和编程题区域 */
.exercises-section,
.programming-section {
  margin-top: 0;
}

.video-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 2px solid #e2e8f0;
  display: flex;
  justify-content: center;
}

/* 费恩曼学习内容样式 */
.feynman-tab-content {
  background: linear-gradient(135deg, #e0f7fa 0%, #b3e5fc 100%);
  border-radius: 16px;
  padding: 0;
}

.feynman-section {
  padding: 32px;
}

.feynman-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 3px solid #0288d1;
}

.feynman-header :deep(.lucide-icon) {
  color: #0288d1;
}

.feynman-header h3 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  color: #01579b;
  background: linear-gradient(135deg, #0288d1 0%, #01579b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.feynman-intro-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.feynman-intro-text {
  font-size: 1.1rem;
  line-height: 1.8;
  color: #01579b;
  background: rgba(255, 255, 255, 0.7);
  padding: 20px;
  border-radius: 12px;
  border-left: 4px solid #0288d1;
  margin: 0;
}

.feynman-intro-text strong {
  color: #01579b;
  font-weight: 700;
}

.feynman-steps,
.feynman-benefits {
  background: rgba(255, 255, 255, 0.8);
  padding: 24px;
  border-radius: 12px;
  border: 2px solid #b3e5fc;
}

.feynman-steps h4,
.feynman-benefits h4 {
  margin: 0 0 16px 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: #01579b;
}

.feynman-steps-list {
  margin: 0;
  padding-left: 24px;
  list-style: none;
  counter-reset: step-counter;
}

.feynman-steps-list li {
  counter-increment: step-counter;
  margin-bottom: 20px;
  padding-left: 40px;
  position: relative;
  color: #0277bd;
}

.feynman-steps-list li::before {
  content: counter(step-counter);
  position: absolute;
  left: 0;
  top: 0;
  background: linear-gradient(135deg, #0288d1 0%, #01579b 100%);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}

.feynman-steps-list li strong {
  display: block;
  font-size: 1.1rem;
  color: #01579b;
  margin-bottom: 8px;
}

.feynman-steps-list li p {
  margin: 0;
  line-height: 1.6;
  color: #0277bd;
}

.feynman-benefits-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.feynman-benefits-list li {
  padding: 12px 0;
  padding-left: 32px;
  position: relative;
  line-height: 1.8;
  color: #0277bd;
  border-bottom: 1px solid #b3e5fc;
}

.feynman-benefits-list li:last-child {
  border-bottom: none;
}

.feynman-benefits-list li strong {
  color: #01579b;
  font-weight: 700;
}

.feynman-tip {
  background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%);
  border: 2px solid #fdd835;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 8px;
}

.feynman-tip :deep(.lucide-icon) {
  color: #f57f17;
  flex-shrink: 0;
  margin-top: 2px;
}

.feynman-tip p {
  margin: 0;
  line-height: 1.7;
  color: #5d4037;
}

.feynman-tip strong {
  color: #3e2723;
}

/* 知识手册整体布局 */
.handbook-full-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 大大的新窗口打开按钮 */
.btn-open-new-window-large {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 24px 32px;
  margin-top: 8px;
  margin-bottom: 0;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  border: 6px solid #0c7cd5;
  border-radius: 12px;
  font-size: 1.8rem;
  font-weight: 900;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
  letter-spacing: 1px;
  cursor: pointer;
}

.btn-open-new-window-large:hover {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 12px 32px rgba(30, 144, 255, 0.5);
  border-width: 7px;
}

.btn-open-new-window-large :deep(.lucide-icon) {
  flex-shrink: 0;
  color: inherit;
}

/* 专项复习课（视频区域） */
.video-section-top {
  background: transparent;
  padding: 0;
  border-radius: 0;
  border: none;
  overflow: visible;
}

.video-header {
  display: none; /* 隐藏原来的header */
}

.video-title {
  display: none;
}

.video-actions {
  display: none;
}

.btn-video-external {
  display: none;
}

.video-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
}

.video-error :deep(.lucide-icon) {
  color: #ef4444;
}

.video-error a {
  color: #38bdf8;
  text-decoration: underline;
}

.section-label {
  color: #0369a1;
  font-size: 1.1rem;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.section-label :deep(.lucide-icon) {
  color: #0ea5e9;
}

.review-section { 
  background: transparent; 
  padding: 0; 
  border-radius: 0; 
  border: none; 
}

.review-label-row {
  display: none; /* 隐藏标签行 */
}

.review-label { 
  display: none;
}

.review-actions {
  display: none; /* 隐藏操作按钮 */
}

.review-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-refresh-handbook {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-refresh-handbook:hover:not(:disabled) {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-refresh-handbook:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-download-handbook {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-download-handbook:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);
}
.review-content-box { 
  background: rgba(255, 255, 255, 0.5); 
  padding: 8px; 
  border-radius: 8px; 
  color: #78350f; 
  line-height: 1.8; 
  word-wrap: break-word;
  flex: 1;
  min-width: 0;
  border: none;
}

/* HTML内容样式 */
.review-content-box :deep(h1),
.review-content-box :deep(h2),
.review-content-box :deep(h3),
.review-content-box :deep(h4) {
  color: #78350f;
  margin: 16px 0 8px 0;
  font-weight: 700;
}

.review-content-box :deep(h1) { font-size: 1.5rem; }
.review-content-box :deep(h2) { font-size: 1.3rem; }
.review-content-box :deep(h3) { font-size: 1.1rem; }

.review-content-box :deep(p) {
  margin: 8px 0;
}

.review-content-box :deep(ul),
.review-content-box :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.review-content-box :deep(li) {
  margin: 4px 0;
}

.review-content-box :deep(strong) {
  font-weight: 700;
  color: #92400e;
}

.review-content-box :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.review-content-box :deep(th),
.review-content-box :deep(td) {
  border: 1px solid #d97706;
  padding: 8px 12px;
  text-align: left;
}

.review-content-box :deep(th) {
  background: #fef3c7;
  font-weight: 600;
}

/* PDF查看器样式 */
.pdf-viewer-container {
  width: 100%;
  height: 90vh;
  min-height: 800px;
  border-radius: 0;
  overflow: hidden;
  background: #f8fafc;
  border: none;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.pdf-viewer {
  width: 100%;
  flex: 1;
  min-height: 0;
  border: none;
}

.pdf-viewer-iframe {
  width: 100%;
  flex: 1;
  min-height: 0;
  border: none;
  background: #f8fafc;
}

.pdf-actions-top {
  display: none; /* 隐藏原来的操作栏，使用大的按钮 */
}

.btn-open-pdf,
.btn-download-pdf {
  display: none;
}

.pdf-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: #64748b;
}

.pdf-fallback :deep(.lucide-icon) {
  color: #94a3b8;
}

/* 知识手册布局 */
.handbook-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.handbook-layout.has-video {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}

@media (max-width: 1024px) {
  .handbook-layout.has-video {
    grid-template-columns: 1fr;
  }
}

/* 视频播放器容器 */
.video-player-container {
  background: #000;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  width: 100%;
  height: calc(100vh - 250px); /* 动态高度，减去顶部导航、按钮和底部空间 */
  min-height: 600px;
  max-height: calc(100vh - 250px);
}

.embedded-video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.embedded-iframe-player {
  width: 100%;
  height: 100%;
  min-height: 600px;
  border: none;
  background: #000;
}

/* 中央播放/暂停按钮 */
.video-center-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: rgba(30, 144, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(30, 144, 255, 0.4);
  z-index: 10;
}

.video-center-btn :deep(.lucide-icon) {
  color: white;
  margin-left: 4px; /* 播放图标视觉居中 */
}

.video-center-btn.is-playing :deep(.lucide-icon) {
  margin-left: 0;
}

.video-center-btn:hover {
  background: rgba(30, 144, 255, 1);
  transform: translate(-50%, -50%) scale(1.1);
  box-shadow: 0 6px 30px rgba(30, 144, 255, 0.5);
}

.video-center-btn.is-playing {
  opacity: 0;
  pointer-events: none;
}

.video-player-container:hover .video-center-btn.is-playing {
  opacity: 0.8;
  pointer-events: auto;
}

/* 自定义视频控制条样式（部分浏览器支持） */
.embedded-video-player::-webkit-media-controls-panel {
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
}

.embedded-video-player::-webkit-media-controls-play-button {
  filter: brightness(1.2);
}

.embedded-video-player::-webkit-media-controls-current-time-display,
.embedded-video-player::-webkit-media-controls-time-remaining-display {
  color: white;
}
.video-link-large { 
  display: inline-flex; 
  align-items: center; 
  gap: 8px; 
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%); 
  color: white; 
  padding: 12px 24px; 
  border-radius: 12px; 
  text-decoration: none; 
  font-weight: 600; 
  transition: all 0.3s ease; 
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
}
.video-link-large:hover { 
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%); 
  transform: translateY(-2px); 
  box-shadow: 0 4px 12px rgba(30, 144, 255, 0.4); 
}
/* 规则说明样式 */
.exam-rules-info,
.oj-rules-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  margin-top: 12px;
}

.exam-rules-info {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 152, 0, 0.1) 100%);
  border: 2px solid rgba(255, 193, 7, 0.3);
}

.oj-rules-info {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%);
  border: 2px solid rgba(34, 197, 94, 0.3);
}

.exam-mode-rules {
  margin-top: 0;
  margin-bottom: 20px;
}

.exam-rules-info :deep(.lucide-icon) {
  color: #f57c00;
  flex-shrink: 0;
}

.oj-rules-info :deep(.lucide-icon) {
  color: #16a34a;
  flex-shrink: 0;
}

.rules-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rules-title {
  font-size: 0.95rem;
  font-weight: 700;
}

.exam-rules-info .rules-title {
  color: #f57c00;
}

.oj-rules-info .rules-title {
  color: #16a34a;
}

.rules-details {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.exam-rules-info .rules-details {
  color: #e65100;
}

.oj-rules-info .rules-details {
  color: #15803d;
}

.rule-item {
  font-weight: 600;
}

.rule-divider {
  color: #ff9800;
  font-weight: 700;
}

/* 提交次数信息样式 */
.submission-count-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(30, 144, 255, 0.1);
  border: 1.5px solid rgba(30, 144, 255, 0.3);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #0277bd;
  margin-bottom: 12px;
}

.submission-count-info :deep(.lucide-icon) {
  color: #1e90ff;
  flex-shrink: 0;
}

/* 专项练习题列表布局 */
.exercises-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.exercise-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exercise-item .exercise-card {
  flex: 1;
  min-width: 0;
}

.exercise-card { background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%); border: 5px solid #1e90ff; border-radius: 20px; padding: 28px; transition: all 0.3s ease; position: relative; overflow: hidden; box-shadow: 0 8px 24px rgba(30, 144, 255, 0.2); }
.exercise-card:hover { border-color: #0c7cd5; border-width: 6px; box-shadow: 0 12px 32px rgba(30, 144, 255, 0.4); transform: translateY(-4px); }
.exercise-icon { font-size: 3.5rem; margin-bottom: 16px; display: flex; justify-content: center; align-items: center; color: #1e90ff; }
.exercise-card h4 { color: #01579b; font-size: 1.4rem; margin: 0 0 12px 0; font-weight: 900; letter-spacing: 0.5px; }
.exercise-desc { color: #0277bd; font-size: 1.05rem; margin: 0 0 16px 0; line-height: 1.7; font-weight: 600; }
.exercise-info { display: flex; gap: 12px; margin-bottom: 16px; font-size: 0.95rem; color: #0277bd; font-weight: 600; }
.difficulty-badge { padding: 8px 16px; border-radius: 16px; font-size: 0.95rem; font-weight: 700; border: 3px solid; }
.difficulty-easy { background: #d1fae5; color: #059669; border-color: #10b981 !important; }
.difficulty-medium { background: #fed7aa; color: #d97706; border-color: #f59e0b !important; }
.difficulty-hard { background: #fecaca; color: #dc2626; border-color: #ef4444 !important; }
.exercise-status { position: absolute; top: 20px; right: 20px; padding: 8px 16px; border-radius: 16px; font-size: 0.9rem; font-weight: 700; border: 3px solid; }
.status-pending { background: #fee2e2; color: #dc2626; border-color: #ef4444 !important; }
.status-completed { background: #d1fae5; color: #059669; border-color: #10b981 !important; }

/* 练习卡片操作按钮 */
.exercise-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 4px solid #1e90ff;
}

.btn-start-exercise {
  flex: 1;
  padding: 14px 20px;
  border: 5px solid #0c7cd5;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.1rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
  letter-spacing: 0.5px;
}

.btn-start-exercise:hover:not(:disabled) {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4);
  border-width: 6px;
}

/* 冻结状态样式 */
.btn-start-exercise.btn-frozen,
.btn-start-exercise:disabled {
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  border-color: #6b7280;
  color: #f3f4f6;
  cursor: not-allowed;
  opacity: 0.7;
  box-shadow: 0 2px 8px rgba(107, 114, 128, 0.2);
}

.btn-start-exercise.btn-frozen:hover,
.btn-start-exercise:disabled:hover {
  transform: none;
  box-shadow: 0 2px 8px rgba(107, 114, 128, 0.2);
  border-width: 5px;
}

.btn-start-exercise :deep(.lucide-icon) {
  font-size: 20px;
  flex-shrink: 0;
  color: inherit;
}

.btn-view-submissions {
  flex: 1;
  padding: 14px 20px;
  border: 5px solid #047857;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.1rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  letter-spacing: 0.5px;
}

.btn-view-submissions:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
  border-width: 6px;
}

.btn-view-submissions :deep(.lucide-icon) {
  font-size: 20px;
  flex-shrink: 0;
  color: inherit;
}

/* 编程题列表布局 */
.programming-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.programming-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.programming-item .exercise-card {
  flex: 1;
  min-width: 0;
}

.btn-video-side {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 24px;
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  color: white;
  border: 5px solid #0c7cd5;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.2rem;
  font-weight: 900;
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
  width: 100%;
  letter-spacing: 0.5px;
}

.btn-video-side:hover {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4);
  border-width: 6px;
}

  .btn-video-side :deep(.lucide-icon) {
    flex-shrink: 0;
    color: inherit;
    width: 28px;
    height: 28px;
  }

  .btn-explanation-side {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 24px;
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    color: white;
    border: 5px solid #0c7cd5;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1.2rem;
    font-weight: 900;
    box-shadow: 0 4px 16px rgba(30, 144, 255, 0.3);
    width: 100%;
    letter-spacing: 0.5px;
  }

  .btn-explanation-side:hover {
    background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4);
    border-width: 6px;
  }

  .btn-explanation-side :deep(.lucide-icon) {
    flex-shrink: 0;
    color: inherit;
    width: 28px;
    height: 28px;
  }
.enter-plan-btn { 
  background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%); 
  color: #fff; 
  border: none; 
  padding: 12px 20px; 
  border-radius: 12px; 
  font-weight: 700; 
  cursor: pointer; 
  transition: all 0.3s ease; 
  display: flex; 
  align-items: center; 
  gap: 8px; 
}
.enter-plan-btn:hover {
  background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(30, 144, 255, 0.35);
}
.feynman-intro { color: #475569; font-size: 0.95rem; line-height: 1.7; margin-bottom: 16px; }

/* 完成提示横幅 */
.completion-banner {
  margin-bottom: 24px;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 3px solid #86efac;
  animation: completionPulse 2s ease-in-out infinite;
}

@keyframes completionPulse {
  0%, 100% {
    box-shadow: 0 8px 32px rgba(34, 197, 94, 0.2);
  }
  50% {
    box-shadow: 0 8px 32px rgba(34, 197, 94, 0.4);
  }
}

.completion-message {
  text-align: center;
  padding: 20px;
}

.completion-icon {
  font-size: 4rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 12px;
  color: #22c55e;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.completion-message h3 {
  color: #059669;
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0 0 8px 0;
}

.completion-time {
  color: #047857;
  font-size: 0.95rem;
  margin: 0;
  font-weight: 500;
}

/* 任务进度卡片 */
.task-progress-card {
  margin-bottom: 24px;
}

.progress-stats {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.progress-stat-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
  border-radius: 12px;
  border: 1px solid #bae6fd;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 任务进度卡片中的进度标签（已移除，保留样式以防其他地方使用） */
.task-progress-card .progress-label {
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
}

.task-progress-card .progress-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e90ff;
}

.progress-bar-container {
  width: 100%;
  height: 12px;
  background: #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #1e90ff 0%, #38bdf8 100%);
  border-radius: 10px;
  transition: width 0.5s ease-in-out;
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
}

  @media (max-width: 768px) {
  .exam-content-flex-row { 
    flex-direction: column; 
    gap: 16px; 
    padding: 0 16px; 
  }
  .sidebar-placeholder-right { display: none; }
  .sidebar-placeholder-left {
    width: auto;
    padding-top: 10px;
    position: static;
  }
  
  .summary-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .summary-actions {
    width: 100%;
  }
  
  .btn-go-to-submissions {
    width: 100%;
    justify-content: center;
  }
  .back-nav-arrow {
    width: 48px;
    height: 48px;
  }
  .back-nav-arrow :deep(.lucide-icon) {
    width: 24px;
    height: 24px;
  }
  .question-main { max-width: 100%; }
  .question-card { 
    height: auto; 
    min-height: calc(100vh - 20px); 
  }
  .question-left-panel { padding: 16px; gap: 16px; padding-right: 0; }
  .exercises-list { 
    grid-template-columns: 1fr; 
  }
  .video-player-container {
    height: calc(100vh - 150px);
    min-height: 400px;
  }
  .embedded-iframe-player {
    min-height: 400px;
  }
  .task-tabs-right-fixed {
    width: 240px; /* 从280px减小到240px，让内容区更大 */
    padding: 16px 12px;
    border-left-width: 5px;
  }
  .task-header-right {
    margin-bottom: 16px;
    padding-bottom: 12px;
  }
  .task-title-right {
    font-size: 1.5rem;
    margin-bottom: 6px;
  }
  .task-desc-right {
    font-size: 1rem;
  }
  .task-tabs-right {
    gap: 12px;
  }
  .task-tab-right {
    padding: 16px 12px;
    font-size: 1.4rem;
    gap: 8px;
    border-width: 4px;
    border-radius: 18px;
  }
  .task-tab-right :deep(.lucide-icon) {
    width: 28px;
    height: 28px;
  }
  .task-tab-right span {
    font-size: 1.4rem;
    letter-spacing: 0.5px;
  }
  .task-tab-right.active {
    border-width: 5px;
    transform: translateX(-2px) scale(1.02);
  }
  }

  @media (max-width: 480px) {
    .question-card-header {
      padding: 16px 20px;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    .back-btn {
      padding: 8px 16px;
      font-size: 0.85rem;
    }
    .number-badge {
      font-size: 0.95rem;
      padding: 8px 16px;
    }
    .task-tabs-right-fixed {
      width: 220px; /* 从240px减小到220px，让内容区更大 */
      padding: 12px 8px;
      border-left-width: 4px;
    }
    .task-header-right {
      margin-bottom: 12px;
      padding-bottom: 10px;
    }
    .task-title-right {
      font-size: 1.3rem;
      margin-bottom: 4px;
    }
    .task-desc-right {
      font-size: 0.9rem;
    }
    .task-tabs-right {
      gap: 10px;
    }
    .task-tab-right {
      padding: 14px 10px;
      font-size: 1.2rem;
      gap: 6px;
      border-width: 3px;
      border-radius: 16px;
    }
    .task-tab-right :deep(.lucide-icon) {
      width: 24px;
      height: 24px;
    }
    .task-tab-right span {
      font-size: 1.2rem;
      letter-spacing: 0.5px;
    }
    .question-left-panel {
      padding-right: 0;
    }
    /* 在移动端隐藏右侧边栏 */
    .task-tabs-right-fixed {
      display: none;
    }
    .video-player-container {
      height: calc(100vh - 120px);
      min-height: 300px;
    }
    .embedded-iframe-player {
      min-height: 300px;
    }
  }

  /* 烟花效果样式 */
  .fireworks-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 10002;
    overflow: hidden;
  }

  .firework {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 
      0 0 10px currentColor,
      0 0 20px currentColor,
      0 0 30px currentColor,
      -30px -30px 0 currentColor,
      30px 30px 0 currentColor,
      -30px 30px 0 currentColor,
      30px -30px 0 currentColor,
      -60px 0 0 currentColor,
      60px 0 0 currentColor,
      0 -60px 0 currentColor,
      0 60px 0 currentColor;
    animation: firework-explode 3s ease-out infinite;
    transform: translate(-50%, -50%);
  }

  .firework:nth-child(1) { color: #1e90ff; }
  .firework:nth-child(2) { color: #38bdf8; }
  .firework:nth-child(3) { color: #06b6d4; }
  .firework:nth-child(4) { color: #22c55e; }
  .firework:nth-child(5) { color: #f59e0b; }
  .firework:nth-child(6) { color: #ef4444; }
  .firework:nth-child(7) { color: #8b5cf6; }
  .firework:nth-child(8) { color: #ec4899; }
  .firework:nth-child(9) { color: #1e90ff; }
  .firework:nth-child(10) { color: #38bdf8; }
  .firework:nth-child(11) { color: #06b6d4; }
  .firework:nth-child(12) { color: #22c55e; }
  .firework:nth-child(13) { color: #f59e0b; }
  .firework:nth-child(14) { color: #ef4444; }
  .firework:nth-child(15) { color: #8b5cf6; }
  .firework:nth-child(16) { color: #ec4899; }
  .firework:nth-child(17) { color: #1e90ff; }
  .firework:nth-child(18) { color: #38bdf8; }
  .firework:nth-child(19) { color: #06b6d4; }
  .firework:nth-child(20) { color: #22c55e; }

  @keyframes firework-explode {
    0% {
      transform: translate(-50%, -50%) scale(0) rotate(0deg);
      opacity: 1;
    }
    15% {
      transform: translate(-50%, -50%) scale(1.2) rotate(180deg);
      opacity: 1;
    }
    50% {
      transform: translate(-50%, -50%) scale(1) rotate(360deg);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(0) rotate(540deg);
      opacity: 0;
    }
  }

  /* 视频弹窗样式 */
  .video-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10003;
    backdrop-filter: blur(4px);
  }

  .video-dialog-container {
    background: #1e293b;
    border-radius: 16px;
    max-width: 98vw;
    max-height: 98vh;
    width: 1600px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: videoDialogIn 0.3s ease-out;
  }

  @keyframes videoDialogIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .video-dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  }

  .video-dialog-header h3 {
    margin: 0;
    color: white;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .video-dialog-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    width: 32px;
    height: 32px;
  }

  .video-dialog-close:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  .video-dialog-content {
    padding: 0;
    background: #000;
  }

  .video-dialog-player {
    width: 100%;
    max-height: 85vh;
    object-fit: contain;
    display: block;
  }

  .video-dialog-iframe {
    width: 100%;
    height: 85vh;
    min-height: 600px;
    border: none;
    display: block;
  }

  /* 解析弹窗样式 */
  .submission-detail-modal,
  .access-denied-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10004;
    backdrop-filter: blur(4px);
  }
  
  .access-denied-modal {
    z-index: 10005;
  }
  
  .access-denied-modal .modal-content {
    max-width: 500px;
    width: 90%;
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
  
  .access-denied-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    text-align: center;
  }
  
  .access-denied-icon {
    margin-bottom: 24px;
    color: #f59e0b;
  }
  
  .access-denied-message p {
    margin: 0;
    color: #64748b;
    font-size: 16px;
    line-height: 1.6;
  }
  
  .access-denied-modal .modal-footer {
    justify-content: center;
  }
  
  .access-denied-modal .btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
  }
  
  .access-denied-modal .btn-primary:hover {
    background: linear-gradient(135deg, #0c7cd5 0%, #1e90ff 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(30, 144, 255, 0.4);
  }

  .modal-content {
    background: white;
    border-radius: 18px;
    max-width: 1400px;
    width: 95%;
    max-height: 95vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    background: linear-gradient(90deg, #1e90ff 0%, #87ceeb 100%);
    color: white;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: background 0.3s;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .modal-body {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
  }

  /* 没有提交记录提示 - 使用与访问被拒绝弹窗一致的样式 */
  .access-denied-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    text-align: center;
  }

  .access-denied-icon {
    margin-bottom: 24px;
    color: #f59e0b;
  }

  .access-denied-message h3 {
    margin: 0 0 16px 0;
    color: #1e293b;
    font-size: 24px;
    font-weight: 600;
  }

  .access-denied-message p {
    margin: 0;
    color: #64748b;
    font-size: 16px;
    line-height: 1.6;
  }

  .detail-summary {
    margin-bottom: 24px;
    padding: 20px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }

  .summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .summary-info {
    flex: 1;
  }

  .summary-info h4 {
    margin: 0 0 8px 0;
    color: #1e293b;
    font-size: 18px;
    font-weight: 600;
  }

  .summary-date {
    margin: 0;
    color: #64748b;
    font-size: 14px;
  }

  .summary-actions {
    flex-shrink: 0;
  }

  .btn-go-to-submissions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(30, 144, 255, 0.3);
  }

  .btn-go-to-submissions:hover {
    background: linear-gradient(135deg, #38bdf8 0%, #1e90ff 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(30, 144, 255, 0.4);
  }

  .btn-go-to-submissions:active {
    transform: translateY(0);
  }

  .answers-section {
    margin-top: 24px;
  }

  .answers-section h4 {
    margin: 0 0 16px 0;
    color: #1e293b;
    font-size: 16px;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px;
  }

  .answers-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .answer-item {
    padding: 16px;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
    background: #f8fafc;
    transition: all 0.3s ease;
  }

  .answer-item.correct {
    border-color: #22c55e;
    background: #f0fdf4;
  }

  .answer-item.incorrect {
    border-color: #ef4444;
    background: #fef2f2;
  }

  .answer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    gap: 16px;
  }

  .question-header-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .question-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .meta-tag {
    padding: 4px 8px;
    background: rgba(30, 144, 255, 0.1);
    border-radius: 4px;
    font-size: 12px;
    color: #1e90ff;
    font-weight: 500;
  }

  .question-number {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
  }

  .answer-status {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }

  .answer-status.correct {
    background: #22c55e;
    color: white;
  }

  .answer-status.incorrect {
    background: #ef4444;
    color: white;
  }

  .question-content {
    margin-bottom: 16px;
  }

  .question-text {
    margin-bottom: 12px;
    color: #374151;
    font-size: 15px;
    line-height: 1.6;
    font-weight: 500;
  }

  .question-code {
    margin-top: 12px;
    background: #1e293b;
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
  }

  .question-code pre {
    margin: 0;
    padding: 0;
  }

  .question-code code {
    color: #e2e8f0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .options-section {
    margin-bottom: 16px;
    padding: 16px;
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .options-title {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 12px;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .option-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.2s ease;
    position: relative;
  }

  .option-item.user-selected {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  .option-item.correct-option {
    background: #f0fdf4;
    border-color: #22c55e;
  }

  .option-item.wrong-selected {
    background: #fef2f2;
    border-color: #ef4444;
  }

  .option-item.user-selected.correct-option {
    background: #f0fdf4;
    border-color: #22c55e;
  }

  .option-label {
    font-weight: 700;
    color: #1e293b;
    min-width: 24px;
    font-size: 15px;
  }

  .option-text {
    flex: 1;
    color: #374151;
    font-size: 14px;
    line-height: 1.5;
  }

  .option-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .correct-mark {
    padding: 4px 8px;
    background: #22c55e;
    color: white;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .user-mark {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .user-mark.correct {
    background: #22c55e;
    color: white;
  }

  .user-mark.wrong {
    background: #ef4444;
    color: white;
  }

  .answer-summary {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: #f8fafc;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .answer-choice, .correct-answer {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .choice-label {
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
  }

  .choice-value {
    font-size: 14px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    background: #e2e8f0;
  }

  .choice-value.correct {
    background: #22c55e;
    color: white;
  }

  .choice-value.incorrect {
    background: #ef4444;
    color: white;
  }

  .explanation-section {
    margin-top: 16px;
    padding: 16px;
    background: #fefce8;
    border-left: 4px solid #f59e0b;
    border-radius: 8px;
  }

  .explanation-title {
    font-size: 14px;
    font-weight: 600;
    color: #92400e;
    margin-bottom: 8px;
  }

  .explanation-text {
    color: #78350f;
    font-size: 14px;
    line-height: 1.6;
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    padding: 24px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    justify-content: flex-end;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(107,114,128,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .btn-secondary {
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
    color: white;
  }

  .btn-secondary:hover {
    background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(107,114,128,0.3);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
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

  /* 考试模式样式 */
  
  /* 考试模式侧边栏 */
  .exam-mode-sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  /* 考试成绩面板（主内容区域） */
  .exam-score-panel {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important;
    border: 3px solid #10b981 !important;
    margin-bottom: 24px;
  }
  
  /* 考试成绩面板（右侧边栏） */
  .exam-score-panel-sidebar {
    background: rgba(255, 255, 255, 0.98);
    border: 5px solid #10b981;
    border-radius: 20px;
    padding: 20px 16px;
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
  }
  
  .exam-score-panel-sidebar .score-panel-header {
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid #a7f3d0;
  }
  
  .exam-score-panel-sidebar .score-panel-header h3 {
    font-size: 1.2rem;
  }
  
  .exam-score-panel-sidebar .score-panel-body {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .exam-score-panel-sidebar .total-score-display {
    padding: 16px 24px;
    width: 100%;
    box-sizing: border-box;
  }
  
  .exam-score-panel-sidebar .total-score-value {
    font-size: 2.5rem;
  }
  
  .exam-score-panel-sidebar .score-breakdown {
    width: 100%;
  }
  
  .exam-score-panel-sidebar .score-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 12px;
  }
  
  .exam-score-panel-sidebar .score-item-header {
    width: 100%;
    font-size: 0.9rem;
  }
  
  .exam-score-panel-sidebar .score-item-value {
    width: 100%;
    text-align: center;
    font-size: 1rem;
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

  .exam-mode-card {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
    border: 3px solid #f59e0b !important;
  }

  .exam-mode-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .exam-mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    padding: 10px 20px;
    border-radius: 24px;
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 16px;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  .exam-mode-header h2 {
    color: #78350f;
    font-size: 1.8rem;
    font-weight: 800;
    margin: 0 0 12px 0;
  }

  .exam-mode-desc {
    color: #92400e;
    font-size: 1rem;
    margin: 0 0 16px 0;
    line-height: 1.6;
  }

  .exam-mode-notice {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    padding: 10px 20px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    border: 1px solid rgba(239, 68, 68, 0.2);
    margin: 0;
  }

  .exam-mode-sections {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .exam-mode-section {
    background: rgba(255, 255, 255, 0.8);
    border-radius: 16px;
    padding: 24px;
    border: 2px solid #fcd34d;
  }

  .exam-section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 2px solid #fcd34d;
  }

  .exam-section-header :deep(.lucide-icon) {
    color: #d97706;
  }

  .exam-section-header h3 {
    margin: 0;
    color: #78350f;
    font-size: 1.3rem;
    font-weight: 700;
    flex: 1;
  }

  .exam-count {
    background: #fef3c7;
    color: #92400e;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .exam-items-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .exam-item-card {
    display: flex;
    align-items: center;
    gap: 16px;
    background: white;
    padding: 16px 20px;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
    transition: all 0.3s ease;
  }

  .exam-item-card:hover {
    border-color: #f59e0b;
    background: #fffbeb;
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.2);
  }

  .exam-item-number {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .exam-item-info {
    flex: 1;
    min-width: 0;
  }

  .exam-item-info h4 {
    margin: 0 0 4px 0;
    color: #1e293b;
    font-size: 1rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .exam-item-info p {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .exam-submission-count-info {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 4px 8px;
    background: rgba(30, 144, 255, 0.1);
    border: 1px solid rgba(30, 144, 255, 0.2);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #0277bd;
  }

  .exam-submission-count-info :deep(.lucide-icon) {
    color: #1e90ff;
    flex-shrink: 0;
  }

  .exam-item-status {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .exam-item-score {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 600;
    flex-shrink: 0;
    background: #f3f4f6;
    color: #9ca3af;
  }

  .exam-item-score.has-score {
    background: #fef3c7;
    color: #d97706;
  }

  .exam-item-score.score-ac {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
  }

  .exam-item-score.score-pac {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
  }

  .exam-item-arrow {
    color: #94a3b8;
    flex-shrink: 0;
    transition: all 0.3s ease;
  }

  .exam-item-card:hover .exam-item-arrow {
    color: #f59e0b;
    transform: translateX(4px);
  }

  /* 考试结束后的样式 */
  .exam-ended-notice {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 2px solid #f59e0b;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 24px;
  }

  .ended-notice-content {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #92400e;
  }

  .ended-notice-content :deep(.lucide-icon) {
    color: #d97706;
    flex-shrink: 0;
  }

  .ended-notice-content p {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
  }

  .exam-item-card.exam-ended {
    opacity: 0.9;
  }

  .exam-item-card.exam-ended:hover {
    border-color: #f59e0b;
    background: #fffbeb;
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.2);
  }

  .exam-action-group {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-exam-action {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    flex-shrink: 0;
  }

  .btn-exam-action:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .btn-exam-action.btn-start-exam {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  }

  .btn-exam-action.btn-start-exam:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  /* 考试模式按钮冻结状态 */
  .btn-exam-action.btn-frozen,
  .btn-exam-action:disabled {
    background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
    color: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.7;
    box-shadow: 0 2px 6px rgba(107, 114, 128, 0.2);
  }

  .btn-exam-action.btn-frozen:hover,
  .btn-exam-action:disabled:hover {
    transform: none;
    box-shadow: 0 2px 6px rgba(107, 114, 128, 0.2);
  }

  .btn-exam-action.btn-video {
    background: linear-gradient(135deg, #1e90ff 0%, #38bdf8 100%);
  }

  .btn-exam-action.btn-video:hover {
    box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
  }

  /* 题库练习提示 */
  .practice-tip-section {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    border: 2px solid #10b981;
    border-radius: 16px;
    padding: 24px;
    margin-top: 24px;
  }

  .practice-tip-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .practice-tip-content > :deep(.lucide-icon) {
    color: #059669;
    flex-shrink: 0;
  }

  .practice-tip-text {
    flex: 1;
  }

  .practice-tip-text h4 {
    margin: 0 0 4px 0;
    color: #047857;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .practice-tip-text p {
    margin: 0;
    color: #059669;
    font-size: 0.95rem;
  }

  .btn-go-practice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    flex-shrink: 0;
  }

  .btn-go-practice:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
  }
  </style>
  
  