const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearEncryptedData() {
  try {
    console.log('🧹 清理加密数据...');
    
    // 清理用户的加密API密钥和token
    const result = await prisma.user.updateMany({
      data: {
        openaiKey: null,
        githubToken: null,
      },
    });
    
    console.log(`✅ 已清理 ${result.count} 个用户的加密数据`);
    console.log('用户需要重新配置 OpenAI API Key');
    
  } catch (error) {
    console.error('❌ 清理失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearEncryptedData();