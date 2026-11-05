import { BlockService } from '../src/blocks/block.service';
import { OutlineRestorer } from '../src/blocks/outline-restorer';
import { LinkParser } from '../src/links/link-parser';
import { LinkRewriter } from '../src/links/link-rewriter';
import { PageService } from '../src/pages/page.service';
import { AiSettingsRepository } from '../src/storage/ai-settings.repository';
import { BlockRepository } from '../src/storage/block.repository';
import { DatabaseService } from '../src/storage/database.service';
import { LinkRepository } from '../src/storage/link.repository';
import { PageRepository } from '../src/storage/page.repository';
import { PgliteConnection } from '../src/storage/pglite-connection';
import { TrashRepository } from '../src/storage/trash.repository';
import { TrashRecorder } from '../src/trash/trash-recorder';

export interface Harness {
  database: DatabaseService;
  pages: PageService;
  blocks: BlockService;
  aiSettings: AiSettingsRepository;
  pageRepository: PageRepository;
  restorer: OutlineRestorer;
  trashRepository: TrashRepository;
  close(): Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const database = new DatabaseService(new PgliteConnection());
  await database.onModuleInit();
  const pageRepository = new PageRepository(database);
  const blockRepository = new BlockRepository(database);
  const linkRepository = new LinkRepository(database);
  const parser = new LinkParser();
  const rewriter = new LinkRewriter();
  const trashRepository = new TrashRepository(database);
  const trash = new TrashRecorder(trashRepository);
  const pages = new PageService(pageRepository, blockRepository, database, parser, rewriter, trash);
  const blocks = new BlockService(blockRepository, pageRepository, linkRepository, pages, parser, rewriter, database, trash);
  const restorer = new OutlineRestorer(blocks, blockRepository);
  return {
    database,
    pages,
    blocks,
    aiSettings: new AiSettingsRepository(database),
    pageRepository,
    restorer,
    trashRepository,
    close: () => database.onModuleDestroy(),
  };
}
