import { createBoardControllerCore } from "./BoardControllerCore";
import { createBoardControllerDeck } from "./BoardControllerDeck";
import { createBoardControllerSummary } from "./BoardControllerSummary";
import { createBoardControllerSpatial } from "./BoardControllerSpatial";
import { createBoardControllerDeckEffects } from "./BoardControllerDeckEffects";
import { createBoardControllerMinimap } from "./BoardControllerMinimap";
import { createBoardControllerData } from "./BoardControllerData";
import { createBoardControllerTasks } from "./BoardControllerTasks";
import { createBoardControllerPointer } from "./BoardControllerPointer";
import { createBoardControllerMining } from "./BoardControllerMining";
import { createBoardControllerLifecycle } from "./BoardControllerLifecycle";
import { createBoardControllerSync } from "./BoardControllerSync";

export function createBoardController() {
  const part0 = createBoardControllerCore();
  const context0 = { ...part0 };
  const part1 = createBoardControllerDeck(context0);
  const context1 = { ...context0, ...part1 };
  const part2 = createBoardControllerSummary(context1);
  const context2 = { ...context1, ...part2 };
  const part3 = createBoardControllerSpatial(context2);
  const context3 = { ...context2, ...part3 };
  const part4 = createBoardControllerDeckEffects(context3);
  const context4 = { ...context3, ...part4 };
  const part5 = createBoardControllerMinimap(context4);
  const context5 = { ...context4, ...part5 };
  const part6 = createBoardControllerData(context5);
  const context6 = { ...context5, ...part6 };
  const part7 = createBoardControllerTasks(context6);
  const context7 = { ...context6, ...part7 };
  const part8 = createBoardControllerPointer(context7);
  const context8 = { ...context7, ...part8 };
  const part9 = createBoardControllerMining(context8);
  const context9 = { ...context8, ...part9 };
  const part10 = createBoardControllerLifecycle(context9);
  const context10 = { ...context9, ...part10 };
  const part11 = createBoardControllerSync(context10);
  const context11 = { ...context10, ...part11 };
  return {
    ...context11,
    boardRef: context11.runtime.boardRef,
    createBoardInputRef: context11.runtime.createBoardInputRef,
    composerParseTimer: context11.runtime.composerParseTimer,
    detailParseTimer: context11.runtime.detailParseTimer,
    composerParseController: context11.runtime.composerParseController,
    detailParseController: context11.runtime.detailParseController,
    composerParseRequestSeq: context11.runtime.composerParseRequestSeq,
    detailParseRequestSeq: context11.runtime.detailParseRequestSeq,
    lastComposerParsedText: context11.runtime.lastComposerParsedText,
    lastDetailParsedText: context11.runtime.lastDetailParsedText,
    hasPrimedExhaustedVillagers: context11.runtime.hasPrimedExhaustedVillagers,
    syncTimer: context11.runtime.syncTimer,
  };
}

export type BoardController = ReturnType<typeof createBoardController>;
