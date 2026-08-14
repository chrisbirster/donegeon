import { css } from "@linaria/core";
import AppShell from "../components/AppShell";
import BoardDesktopSidebar from "../components/board/BoardDesktopSidebar";
import BoardHeaderActions from "../components/board/BoardHeaderActions";
import BoardMobileSidebar from "../components/board/BoardMobileSidebar";
import BoardNotificationHistory from "../components/board/BoardNotificationHistory";
import BoardSettingsModal from "../components/board/BoardSettingsModal";
import BoardStage from "../components/board/BoardStage";
import BoardTaskDetailModal from "../components/board/BoardTaskDetailModal";

export default function BoardView() {
  return (
    <AppShell
      activeView="board"
      accountPlacement="sidebar"
      mobileSidebar={<BoardMobileSidebar />}
      headerRight={<BoardHeaderActions />}
    >
      <div class={style1}>
        <BoardDesktopSidebar />
        <BoardStage />
      </div>
      <BoardNotificationHistory />
      <BoardSettingsModal />
      <BoardTaskDetailModal />
    </AppShell>
  );
}


const style1 = css`
display: grid;
height: 100%;
min-height: calc(var(--spacing) * 0);
grid-template-columns: repeat(1, minmax(0, 1fr));
overflow: hidden;
@media (width >= 48rem) {
    grid-template-columns: 280px minmax(0,1fr);
  }
`;
