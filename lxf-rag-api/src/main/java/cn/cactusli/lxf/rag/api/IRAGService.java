package cn.cactusli.lxf.rag.api;

import cn.cactusli.lxf.rag.api.response.Response;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Package: cn.cactusli.lxf.rag.api
 * Description:
 *
 * @Author 仙人球⁶ᴳ |
 * @Date 2025/4/3 10:19
 * @Github https://github.com/lixuanfengs
 */
public interface IRAGService {

    Response<List<String>> queryRagTagList();

    Response<String> uploadFile(String ragTag, List<MultipartFile> files);

    Response<String> analyzeGitRepository(String repoUrl, String userName, String token) throws Exception;

}
