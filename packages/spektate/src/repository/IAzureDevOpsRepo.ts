import { HttpHelper } from "../HttpHelper";
import { IAuthor } from "./Author";
import { ITag } from "./Tag";

const authorInfoURL =
  "https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/commits/{commitId}?api-version=4.1";
const manifestSyncTagsURL =
  "https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/refs?filter=tags&api-version=4.1";
const manifestSyncTagURL =
  "https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repositoryId}/annotatedtags/{objectId}?api-version=4.1-preview.1";

export interface IAzureDevOpsRepo {
  org: string;
  project: string;
  repo: string;
}

export const getReleasesURL = (repository: IAzureDevOpsRepo): string => {
  return (
    "https://dev.azure.com/" +
    repository.org +
    "/" +
    repository.project +
    "/_git/" +
    repository.repo +
    "/tags"
  );
};

export const getManifestSyncState = async (
  repository: IAzureDevOpsRepo,
  accessToken?: string
): Promise<ITag[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await HttpHelper.httpGet<any>(
        manifestSyncTagsURL
          .replace("{organization}", repository.org)
          .replace("{project}", repository.project)
          .replace("{repositoryId}", repository.repo),
        accessToken
      );

      const tags = data.data.value;
      const fluxTags: ITag[] = [];
      if (tags != null && tags.length > 0) {
        for (const tag of tags) {
          // Check all flux sync tags
          if (tag.name.includes("refs/tags/flux-")) {
            const syncStatus = await HttpHelper.httpGet<any>(
              manifestSyncTagURL
                .replace("{organization}", repository.org)
                .replace("{project}", repository.project)
                .replace("{repositoryId}", repository.repo)
                .replace("{objectId}", tag.objectId),
              accessToken
            );

            if (syncStatus != null) {
              const clusterName: string = syncStatus.data.name.replace(
                "flux-",
                ""
              );
              const manifestSync = {
                commit: syncStatus.data.taggedObject.objectId.substring(0, 7),
                date: new Date(syncStatus.data.taggedBy.date),
                name: clusterName.toUpperCase(),
                tagger: syncStatus.data.taggedBy.name
              };
              fluxTags.push(manifestSync);
            }
          }
        }
        resolve(fluxTags);
        return;
      }
      // No tags were found.
      resolve([]);
    } catch (err) {
      reject(err);
    }
  });
};

export const getAuthor = async (
  repository: IAzureDevOpsRepo,
  commitId: string,
  accessToken?: string
) => {
  const data = await HttpHelper.httpGet<any>(
    authorInfoURL
      .replace("{organization}", repository.org)
      .replace("{project}", repository.project)
      .replace("{repositoryId}", repository.repo)
      .replace("{commitId}", commitId),
    accessToken
  );

  const commitInfo = data.data;
  if (commitInfo && commitInfo.author) {
    const author: IAuthor = {
      imageUrl: commitInfo.author.imageUrl,
      name: commitInfo.author.name,
      url: commitInfo.author.imageUrl,
      username: commitInfo.author.email
    };
    return author;
  }
};
