import AppShell from "../components/AppShell";
import HomeDesktopSidebar from "../components/task/HomeDesktopSidebar";
import HomeMobileSidebar from "../components/task/HomeMobileSidebar";
import HomeSearchModal from "../components/task/HomeSearchModal";
import HomeTaskContent from "../components/task/HomeTaskContent";
import HomeTaskDetailModal from "../components/task/HomeTaskDetailModal";

export default function HomeView() {
  return (
    <AppShell activeView="task" accountPlacement="sidebar" mobileSidebar={<HomeMobileSidebar />}>
      <div class="h-full overflow-hidden p-3 md:p-6">
        <div class="grid h-full min-h-0 w-full grid-cols-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
          <HomeDesktopSidebar />
          <HomeTaskContent />
        </div>
        <HomeSearchModal />
        <HomeTaskDetailModal />
      </div>
    </AppShell>
  );
}
