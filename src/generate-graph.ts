process.env.GENERATE_GRAPH = 'true';

import { NestFactory } from '@nestjs/core';
import { SpelunkerModule } from 'nestjs-spelunker';
import { AppModule } from './app.module';

async function generateGraph() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const tree = SpelunkerModule.explore(app);
  const root = SpelunkerModule.graph(tree);
  const edges = SpelunkerModule.findGraphEdges(root);

  const mermaid = edges.map(
    (e) => `${e.from.module.name} --> ${e.to.module.name}`,
  );

  console.log('graph TD');
  console.log(mermaid.join('\n'));

  await app.close();
}

generateGraph();