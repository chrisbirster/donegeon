import { css } from "@linaria/core";
import AppShell from "../components/AppShell";
import HomeDesktopSidebar from "../components/task/HomeDesktopSidebar";
import HomeMobileSidebar from "../components/task/HomeMobileSidebar";
import HomeSearchModal from "../components/task/HomeSearchModal";
import HomeTaskContent from "../components/task/HomeTaskContent";
import HomeTaskDetailModal from "../components/task/HomeTaskDetailModal";

export default function HomeView() {
  return (
    <AppShell activeView="task" accountPlacement="sidebar" mobileSidebar={<HomeMobileSidebar />}>
      <div class={style1}>
        <div class={style2}>
          <HomeDesktopSidebar />
          <HomeTaskContent />
        </div>
        <HomeSearchModal />
        <HomeTaskDetailModal />
      </div>
    </AppShell>
  );
}


const style1 = css`
height: 100%;
overflow: hidden;
padding: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    padding: calc(var(--spacing) * 6);
  }
`;

const style2 = css`
display: grid;
height: 100%;
min-height: calc(var(--spacing) * 0);
width: 100%;
grid-template-columns: repeat(1, minmax(0, 1fr));
gap: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    grid-template-columns: 300px minmax(0,1fr);
  }
`;
