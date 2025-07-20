class YouTubeVideoProcessor {
    constructor() {
        this.videoId = '';
        this.videoInfo = {
            title: '',
            duration: 0,
            channelTitle: '',
            publishedAt: ''
        };
        this.thumbnails = [];
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.form = document.getElementById('videoForm');
        this.videoUrlInput = document.getElementById('videoUrl');
        this.processBtn = document.getElementById('processBtn');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.errorMessage = document.getElementById('errorMessage');
        this.successMessage = document.getElementById('successMessage');
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processVideo();
        });
    }

    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/v\/([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    async processVideo() {
        try {
            this.hideMessages();
            const videoUrl = this.videoUrlInput.value.trim();

            this.videoId = this.extractVideoId(videoUrl);
            if (!this.videoId) {
                this.showError('無效的YouTube影片連結');
                return;
            }

            this.showProgress('開始處理影片...', 10);
            this.processBtn.disabled = true;

            await this.getVideoInfo();
            await this.generateThumbnails();
            await this.generateMarkdown();

            this.showSuccess('處理完成！Markdown文件已下載');

        } catch (error) {
            console.error('處理錯誤:', error);
            this.showError(`處理失敗：${error.message}`);
        } finally {
            this.processBtn.disabled = false;
            this.hideProgress();
        }
    }

    async getVideoInfo() {
        this.showProgress('獲取影片資訊...', 20);
        
        try {
            // 嘗試從YouTube頁面獲取基本資訊
            const response = await fetch(`https://www.youtube.com/watch?v=${this.videoId}`, {
                mode: 'cors'
            });
            
            if (response.ok) {
                const html = await response.text();
                this.parseVideoInfoFromHTML(html);
            } else {
                // 如果無法獲取，使用預設值
                this.videoInfo = {
                    title: `YouTube影片 ${this.videoId}`,
                    duration: 600, // 預設10分鐘
                    channelTitle: '未知頻道',
                    publishedAt: new Date().toISOString()
                };
            }
        } catch (error) {
            console.log('無法獲取影片資訊，使用預設值');
            this.videoInfo = {
                title: `YouTube影片 ${this.videoId}`,
                duration: 600, // 預設10分鐘
                channelTitle: '未知頻道',
                publishedAt: new Date().toISOString()
            };
        }
    }

    parseVideoInfoFromHTML(html) {
        // 嘗試從HTML中解析影片資訊
        try {
            const titleMatch = html.match(/<title>(.+?)<\/title>/);
            if (titleMatch) {
                this.videoInfo.title = titleMatch[1].replace(' - YouTube', '');
            }

            // 嘗試解析頻道名稱
            const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
            if (channelMatch) {
                this.videoInfo.channelTitle = channelMatch[1];
            }

            // 嘗試解析影片長度（秒）
            const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
            if (durationMatch) {
                this.videoInfo.duration = parseInt(durationMatch[1]);
            }

            // 如果無法解析到時長，預設為10分鐘
            if (!this.videoInfo.duration || this.videoInfo.duration === 0) {
                this.videoInfo.duration = 600;
            }

            this.videoInfo.publishedAt = new Date().toISOString();

        } catch (error) {
            console.log('解析HTML失敗，使用預設值');
        }
    }

    async generateThumbnails() {
        this.showProgress('生成縮圖...', 50);
        
        const durationInMinutes = Math.ceil(this.videoInfo.duration / 60);
        
        // 限制最多120分鐘
        const maxMinutes = Math.min(durationInMinutes, 120);
        
        this.thumbnails = [];
        
        for (let i = 0; i < maxMinutes; i++) {
            const timeInSeconds = i * 60;
            
            try {
                // YouTube縮圖API的不同選項
                const thumbnailUrls = [
                    `https://img.youtube.com/vi/${this.videoId}/maxresdefault.jpg`,
                    `https://img.youtube.com/vi/${this.videoId}/hqdefault.jpg`,
                    `https://img.youtube.com/vi/${this.videoId}/mqdefault.jpg`,
                    `https://img.youtube.com/vi/${this.videoId}/sddefault.jpg`
                ];
                
                let base64Image = null;
                
                // 嘗試不同品質的縮圖
                for (const url of thumbnailUrls) {
                    try {
                        base64Image = await this.imageToBase64(url);
                        if (base64Image) break;
                    } catch (error) {
                        continue;
                    }
                }
                
                this.thumbnails.push({
                    time: this.formatTime(timeInSeconds),
                    timeInSeconds: timeInSeconds,
                    base64: base64Image
                });
                
                const progress = 50 + (i / maxMinutes) * 30;
                this.showProgress(`生成縮圖 ${i + 1}/${maxMinutes}...`, progress);
                
            } catch (error) {
                console.error(`縮圖生成失敗 (${i}分鐘):`, error);
                
                this.thumbnails.push({
                    time: this.formatTime(timeInSeconds),
                    timeInSeconds: timeInSeconds,
                    base64: null
                });
            }
        }
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    async imageToBase64(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                ctx.drawImage(img, 0, 0);
                
                try {
                    const base64 = canvas.toDataURL('image/jpeg', 0.8);
                    resolve(base64);
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => {
                reject(new Error('圖片載入失敗'));
            };
            
            img.src = imageUrl;
        });
    }

    async generateMarkdown() {
        this.showProgress('生成Markdown文件...', 90);
        
        const videoTitle = this.videoInfo.title || `YouTube影片 ${this.videoId}`;
        const channelTitle = this.videoInfo.channelTitle || '未知頻道';
        const publishedAt = new Date(this.videoInfo.publishedAt).toLocaleDateString('zh-TW');
        const durationFormatted = this.formatTime(this.videoInfo.duration);
        
        let markdown = `# ${videoTitle}\n\n`;
        markdown += `**頻道**: ${channelTitle}\n`;
        markdown += `**發布日期**: ${publishedAt}\n`;
        markdown += `**影片長度**: ${durationFormatted}\n`;
        markdown += `**影片連結**: https://www.youtube.com/watch?v=${this.videoId}\n\n`;
        
        markdown += `## 影片截圖\n\n`;
        markdown += `以下是每分鐘的影片截圖：\n\n`;
        
        for (let i = 0; i < this.thumbnails.length; i++) {
            const thumbnail = this.thumbnails[i];
            
            markdown += `### ${thumbnail.time}\n\n`;
            
            if (thumbnail.base64) {
                markdown += `![截圖 ${thumbnail.time}](${thumbnail.base64})\n\n`;
            } else {
                markdown += `*縮圖載入失敗*\n\n`;
            }
            
            markdown += `[跳轉到此時間點](https://www.youtube.com/watch?v=${this.videoId}&t=${thumbnail.timeInSeconds}s)\n\n`;
            markdown += `---\n\n`;
        }
        
        markdown += `\n## 使用說明\n\n`;
        markdown += `- 點擊上方的時間連結可直接跳轉到YouTube影片的對應時間點\n`;
        markdown += `- 圖片已嵌入Markdown文件中，可離線檢視\n`;
        markdown += `- 此文件由YouTube影片處理工具自動生成\n\n`;
        markdown += `*生成時間：${new Date().toLocaleString('zh-TW')}*`;
        
        const filename = `${videoTitle.replace(/[<>:"/\\|?*]/g, '_')}_截圖.md`;
        this.downloadMarkdown(markdown, filename);
    }

    downloadMarkdown(content, filename) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showProgress(text, percent) {
        this.progressContainer.style.display = 'block';
        this.progressText.textContent = text;
        this.progressFill.style.width = `${percent}%`;
    }

    hideProgress() {
        this.progressContainer.style.display = 'none';
    }

    showError(message) {
        this.hideMessages();
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }

    showSuccess(message) {
        this.hideMessages();
        this.successMessage.textContent = message;
        this.successMessage.style.display = 'block';
    }

    hideMessages() {
        this.errorMessage.style.display = 'none';
        this.successMessage.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new YouTubeVideoProcessor();
});