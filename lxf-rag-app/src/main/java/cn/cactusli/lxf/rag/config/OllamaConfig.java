package cn.cactusli.lxf.rag.config;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.OllamaEmbeddingModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.springframework.ai.ollama.api.OllamaModel.NOMIC_EMBED_TEXT;

/**
 * Package: cn.cactusli.lxf.rag.app.config
 * Description:
 *
 * @Author 仙人球⁶ᴳ |
 * @Date 2025/3/14 14:25
 * @Github https://github.com/lixuanfengs
 */
@Configuration
public class OllamaConfig {

    @Bean
    public OllamaApi ollamaApi(@Value("${spring.ai.ollama.base-url}") String baseUrl) {
        return new OllamaApi(baseUrl);
    }

    @Bean
    public OpenAiApi openAiApi(@Value("${spring.ai.openai.base-url}") String baseUrl, @Value("${spring.ai.openai.api-key}") String apiKey) {
        return OpenAiApi.builder().baseUrl(baseUrl)
                .apiKey(apiKey)
                .build();
    }


    @Bean
    public OllamaChatModel ollamaChatModel(OllamaApi ollamaApi) {
        return OllamaChatModel.builder()
                .ollamaApi(ollamaApi)
                .defaultOptions(
                        OllamaOptions.builder()
                                .temperature(0.9)
                                .build())
                .build();
    }

    @Bean
    public TokenTextSplitter tokenTextSplitter() {
        return new TokenTextSplitter();
    }


    @Bean
    public SimpleVectorStore simpleVectorStore(@Value("${spring.ai.rag.embedding}") String model, OllamaApi ollamaApi,  OpenAiApi openAiApi) {
        if ("nomic-embed-text".equalsIgnoreCase(model)) {
            // 嵌入生成客户端指定使用"nomic-embed-text"这个模型来生成嵌入向量
            OllamaEmbeddingModel embeddingModel = OllamaEmbeddingModel.builder()
                    .ollamaApi(ollamaApi)
                    .defaultOptions(
                            OllamaOptions.builder()
                                    .model(NOMIC_EMBED_TEXT)
                                    .build())
                    .build();
            return SimpleVectorStore.builder(embeddingModel).build();
        } else {
            OpenAiEmbeddingModel openAiEmbeddingModel = new OpenAiEmbeddingModel(openAiApi);
            return SimpleVectorStore.builder(openAiEmbeddingModel).build();
        }

    }

    /**
     * -- 删除旧的表（如果存在）
     * DROP TABLE IF EXISTS public.vector_store_ollama_deepseek;
     *
     * -- 创建新的表，使用UUID作为主键
     * CREATE TABLE public.vector_store_ollama_deepseek (
     *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     *     content TEXT NOT NULL,
     *     metadata JSONB,
     *     embedding VECTOR(768)
     * );
     *
     * SELECT * FROM vector_store_ollama_deepseek
     */
    /**
     * -- 删除旧的表（如果存在）
     * DROP TABLE IF EXISTS public.vector_store_openai;
     *
     * -- 创建新的表，使用UUID作为主键
     * CREATE TABLE public.vector_store_openai (
     *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     *     content TEXT NOT NULL,
     *     metadata JSONB,
     *     embedding VECTOR(1536)
     * );
     *
     * SELECT * FROM vector_store_openai
     */
    @Bean
    public PgVectorStore pgVectorStore(@Value("${spring.ai.rag.embedding}") String model, OllamaApi ollamaApi,  OpenAiApi openAiApi, JdbcTemplate jdbcTemplate) {
        if ("nomic-embed-text".equalsIgnoreCase(model)) {
            OllamaEmbeddingModel embeddingModel = OllamaEmbeddingModel.builder()
                    // 如果 nomic-embed-text 和 deepseek-r1 不在同一个 ollama 中
                    .ollamaApi(new OllamaApi("http://192.168.1.23:11434/"))
                    .defaultOptions(
                            OllamaOptions.builder()
                                    .model(NOMIC_EMBED_TEXT)
                                    .build())
                    .build();
            return PgVectorStore.builder(jdbcTemplate, embeddingModel).vectorTableName("vector_store_ollama_deepseek").build();
        } else {
            OpenAiEmbeddingModel openAiEmbeddingModel = new OpenAiEmbeddingModel(openAiApi);
            return PgVectorStore.builder(jdbcTemplate, openAiEmbeddingModel)
                    .vectorTableName("vector_store_openai")
                    .build();
        }
    }

}
