import { Module } from '@nestjs/common';
import { LinkParser } from './link-parser';
import { LinkRewriter } from './link-rewriter';

@Module({
  providers: [LinkParser, LinkRewriter],
  exports: [LinkParser, LinkRewriter],
})
export class LinksModule {}
