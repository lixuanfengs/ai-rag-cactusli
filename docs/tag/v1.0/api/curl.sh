curl http://218.249.73.249:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
        "model": "deepseek-r1:1.5b",
        "prompt": "你是哪个模型？",
        "stream": false
      }'