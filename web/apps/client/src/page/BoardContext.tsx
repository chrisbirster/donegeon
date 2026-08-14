import { createContext, useContext, type ParentProps } from "solid-js";
import type { BoardController } from "./BoardController";

const BoardContext = createContext<BoardController>();

export function BoardProvider(props: ParentProps<{ value: BoardController }>) {
  return <BoardContext value={props.value}>{props.children}</BoardContext>;
}

export function useBoard() {
  return useContext(BoardContext);
}
