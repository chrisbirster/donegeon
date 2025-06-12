import { css, cx } from '@linaria/core';
import {
  Calendar,
  CalendarDays,
  Inbox,
  Filter,
  Hash,
  ChevronDown,
  Plus,
  Search,
  HelpCircle,
  Bell,
  PanelLeft
} from 'lucide-solid';
import { createSignal, Show, type Setter } from 'solid-js';

const container = css`
  background: #1f2937;
  border-right: 1px solid #374151;
  display: flex;
  flex-direction: column;
  transition: width 0.4s ease-in-out;
  overflow: hidden;
`;

const containerExpanded = css`width: 20rem;`;
const containerCollapsed = css`
width: 0rem; 
border: none;
`;

const sidebarHeader = css`
  padding: 1rem;
  border-bottom: 1px solid #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const avatar = css`
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: #f97316;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 0.875rem;
`;

const navSection = css`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
`;

const navButton = css`
  width: 100%;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: transparent;
  border: none;
  color: #d1d5db;
  cursor: pointer;
  font-size: 0.95rem;
  &:hover {
    background: #374151;
  }
`;

const navButtonActive = css`
  background: rgba(220, 38, 38, 0.2);
  color: #f87171;
`;

const badge = css`
  margin-left: auto;
  background: #374151;
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #d1d5db;
`;

const sidebarFooter = css`
  padding: 0.5rem 1rem;
  border-top: 1px solid #374151;
`;

const leftSide = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
`;

const rightSide = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
`;

type SidebarProps = {
  setShowModal: Setter<boolean>;
};

export const Sidebar = (props: SidebarProps) => {
  const [expand, setExpand] = createSignal(true);
  const handleShowModal = () => props.setShowModal(true);

  return (
    <>
      <Show when={!expand()}>
        <div class={css`padding: 1rem;`}>
          <PanelLeft
            size={20}
            color="#6b7280"
            onClick={() => setExpand(true)}
          />
        </div>

      </Show>
      <aside class={cx(container, expand() ? containerExpanded : containerCollapsed)}>
        <div class={sidebarHeader}>
          <Show when={expand()}>
            <div class={leftSide}>
              <div class={avatar}>C</div>
              <span>Chris</span>
              <ChevronDown size={16} color="#9ca3af" />
            </div>
            <div class={rightSide}>
              <Bell size={20} color="#6b7280" />
              <PanelLeft
                size={20}
                color="#6b7280"
                onClick={() => setExpand(false)}
              />
            </div>
          </Show>
        </div>

        <Show when={expand()}>
          <nav class={navSection}>
            <button class={navButton} onClick={handleShowModal}><Plus size={16} /> Add task</button>
            <button class={navButton}><Search size={16} /> Search</button>

            <button class={navButton}><Inbox size={16} /> Inbox <span class={badge}>12</span></button>
            <button class={cx(navButton, navButtonActive)}>
              <Calendar size={16} />
              Today
              <span class={cx(badge, css`background:#991b1b; color:white;`)}>4</span>
            </button>
            <button class={navButton}><CalendarDays size={16} /> Upcoming</button>
            <button class={navButton}><Filter size={16} /> Filters & Labels</button>

            <div class={css`margin:1rem 0 0.5rem; padding:0 1rem; color:#6b7280; font-size:0.85rem;`}>
              Favorites
            </div>
            <button class={navButton}><Hash size={16} /> To-do list 🧠</button>

            <div class={css`margin:1rem 0 0.5rem; padding:0 1rem; color:#6b7280; font-size:0.85rem;`}>
              My Projects
            </div>
            <button class={navButton}><Hash size={16} /> Blog Posts</button>
            <button class={navButton}><Hash size={16} /> Personal</button>
            <button class={navButton}><Hash size={16} /> To-do list 🧠</button>
          </nav>

          <div class={sidebarFooter}>
            <button class={navButton}><HelpCircle size={16} /> Help</button>
          </div>
        </Show>
      </aside >
    </>
  );
};
