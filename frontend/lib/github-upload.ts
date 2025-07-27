// GitHub文件上传工具
export interface GitHubUploadConfig {
  owner: string;
  repo: string;
  token: string;
  path: string;
}

export async function uploadToGitHub(
  file: File,
  config: GitHubUploadConfig
): Promise<string> {
  try {
    // 将文件转换为base64
    const base64Content = await fileToBase64(file);
    
    // 生成文件路径
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${config.path}/${fileName}`;
    
    // GitHub API URL
    const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;
    
    // 准备请求数据
    const requestData = {
      message: `Upload image: ${fileName}`,
      content: base64Content.split(',')[1], // 移除data:image/...;base64,前缀
      branch: 'main'
    };
    
    // 发送请求到GitHub API
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API错误: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // 返回GitHub raw文件URL
    const rawUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/main/${filePath}`;
    
    console.log('GitHub上传成功:', {
      fileName,
      path: filePath,
      downloadUrl: result.content.download_url,
      rawUrl
    });
    
    return rawUrl;
    
  } catch (error) {
    console.error('GitHub上传失败:', error);
    throw error;
  }
}

// 将文件转换为base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 默认配置（可以从环境变量或用户设置中获取）
export const defaultGitHubConfig: Partial<GitHubUploadConfig> = {
  owner: 'Rain1601',
  repo: 'Muses',
  path: 'uploads',
  // token需要用户在设置中配置，或从环境变量获取
  // token: process.env.NEXT_PUBLIC_GITHUB_TOKEN
};

// 检查GitHub配置是否完整
export function isGitHubConfigValid(config: Partial<GitHubUploadConfig>): config is GitHubUploadConfig {
  return !!(config.owner && config.repo && config.token && config.path);
}

// 获取GitHub配置（可以从localStorage或其他地方获取用户设置）
export function getGitHubConfig(): GitHubUploadConfig | null {
  try {
    // 尝试从localStorage获取用户配置
    const savedConfig = localStorage.getItem('github-upload-config');
    if (savedConfig) {
      const config = { ...defaultGitHubConfig, ...JSON.parse(savedConfig) };
      if (isGitHubConfigValid(config)) {
        return config;
      }
    }
    
    // 如果没有保存的配置，检查环境变量
    const envConfig = {
      ...defaultGitHubConfig,
      token: process.env.NEXT_PUBLIC_GITHUB_TOKEN
    };
    
    if (isGitHubConfigValid(envConfig)) {
      return envConfig;
    }
    
    return null;
  } catch (error) {
    console.error('获取GitHub配置失败:', error);
    return null;
  }
}

// 保存GitHub配置到localStorage
export function saveGitHubConfig(config: Partial<GitHubUploadConfig>): void {
  try {
    localStorage.setItem('github-upload-config', JSON.stringify(config));
  } catch (error) {
    console.error('保存GitHub配置失败:', error);
  }
}