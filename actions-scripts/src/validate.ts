import { promises as fs } from "fs"
import { remark } from "remark"
import { VFile } from "vfile"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkGithubImages from "remark-github-images"

interface WrappedVFile {
  fileName: string
  file: VFile
}

try {
  await main()
  console.log("Validation completed.")
} catch (err) {
  console.log(`Uncaught exception: \n\n${err}`)
}

async function main() {
  const unpublishedDir = "../Posts/unpublished/"
  const publishedDir = "../Posts/published/"
  const baseUrl = "https://github.com/bdashore3/kingsite-blog/blob/default"

  let mdFiles: string[] = []
  try {
    mdFiles = mdFiles.concat(await fs.readdir(unpublishedDir))
  } catch {
    throw Error("Could not find the unpublished posts directory!")
  }

  // If there are no files, don't waste any time
  if (mdFiles.length <= 0) {
    return
  }

  const promises: Promise<WrappedVFile>[] = []
  for (const fileName of mdFiles) {
    promises.push(editMd(unpublishedDir, fileName, baseUrl))
  }

  // Remove any files that failed a check
  const mdResults = (await Promise.allSettled(promises))
    .filter((p) => p.status === "fulfilled")
    .map((p) => p as PromiseFulfilledResult<WrappedVFile>)

  try {
    await fs.access(publishedDir)
  } catch {
    fs.mkdir(publishedDir)
  }

  for (const newFile of mdResults) {
    await fs.writeFile(
      publishedDir + newFile.value.fileName,
      newFile.value.file.value
    )

    // If the file exists, remove the unpublished version
    try {
      await fs.stat(publishedDir + newFile.value.fileName)
      await fs.unlink(unpublishedDir + newFile.value.fileName)
    } catch {
      continue
    }
  }
}

async function editMd(
  directoryPath: string,
  fileName: string,
  baseUrl: string
): Promise<WrappedVFile> {
  const file = await fs.readFile(directoryPath + fileName)
  const newFile = await remark()
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkGithubImages, {
      baseUrl: baseUrl,
    })
    .process(file)

  return {
    fileName: fileName,
    file: newFile,
  }
}
