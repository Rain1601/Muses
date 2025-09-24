#!/bin/bash

# RAG系统测试脚本
# 使用前需要先登录获取token

echo "========================================="
echo "RAG知识库系统测试脚本"
echo "========================================="

# 设置API基础URL
API_BASE="http://localhost:8080/api/knowledge"

# 需要先获取token (从localStorage或手动设置)
echo ""
echo "请输入你的JWT Token (在主应用登录后从浏览器控制台获取):"
echo "在控制台运行: localStorage.getItem('token')"
read -r TOKEN

if [ -z "$TOKEN" ]; then
    echo "错误: Token不能为空"
    exit 1
fi

# 测试函数
test_api() {
    local endpoint=$1
    local method=$2
    local data=$3
    local description=$4

    echo ""
    echo "📍 测试: $description"
    echo "   端点: $endpoint"

    if [ "$method" == "GET" ]; then
        response=$(curl -s -X GET \
            -H "Authorization: Bearer $TOKEN" \
            "$API_BASE$endpoint")
    elif [ "$method" == "DELETE" ]; then
        response=$(curl -s -X DELETE \
            -H "Authorization: Bearer $TOKEN" \
            "$API_BASE$endpoint")
    else
        response=$(curl -s -X POST \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint")
    fi

    echo "   响应: $response" | python3 -m json.tool 2>/dev/null || echo "   响应: $response"
}

# 1. 获取统计信息
test_api "/stats" "GET" "" "获取知识库统计"

# 2. 添加文档
test_api "/add" "POST" '{
    "text": "人工智能正在革命性地改变世界。从深度学习到自然语言处理，AI技术不断突破边界。",
    "source": "test",
    "metadata": {"topic": "AI"}
}' "添加测试文档"

# 3. 搜索知识
test_api "/search" "POST" '{
    "query": "深度学习",
    "n_results": 3
}' "搜索相关知识"

# 4. 测试RAG
echo ""
echo "📍 测试: 测试RAG生成"
echo "   端点: /test-rag"
response=$(curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/test-rag?query=$(echo '什么是人工智能' | python3 -c 'import sys; import urllib.parse; print(urllib.parse.quote(sys.stdin.read().strip()))')")
echo "   响应: $response" | python3 -m json.tool 2>/dev/null || echo "   响应: $response"

echo ""
echo "========================================="
echo "测试完成！"
echo "========================================="