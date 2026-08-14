import { BoardProvider } from "./BoardContext";
import { createBoardController } from "./BoardController";
import BoardView from "./BoardView";

export default function BoardRoute() {
  const controller = createBoardController();
  return (
    <BoardProvider value={controller}>
      <BoardView />
    </BoardProvider>
  );
}
