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
      <div class="grid h-full min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
        <BoardDesktopSidebar />
        <BoardStage />
      </div>
      <BoardNotificationHistory />
      <BoardSettingsModal />
      <BoardTaskDetailModal />
    </AppShell>
  );
}
