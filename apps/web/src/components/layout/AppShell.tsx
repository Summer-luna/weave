import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useHistoryShortcuts } from '../../controllers/use-history-shortcuts';
import { useLayoutController } from '../../controllers/use-layout-controller';
import { MobileEditToolbar } from '../editor/MobileEditToolbar';
import { RightSidebar } from './RightSidebar';
import { SearchDialog } from './SearchDialog';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useIsMobile } from './use-is-mobile';

export function AppShell() {
  const [searching, setSearching] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const layout = useLayoutController();
  const mobile = useIsMobile();
  useHistoryShortcuts();
  const href = useRouterState({ select: (state) => state.location.href });

  useEffect(() => {
    setDrawerOpen(false);
    setMobileRightOpen(false);
  }, [href]);

  const initialSidebar = useRef(layout.sidebar);
  useEffect(() => {
    if (mobile && layout.sidebar.length > 0 && layout.sidebar !== initialSidebar.current) setMobileRightOpen(true);
  }, [mobile, layout.sidebar]);

  const initialAi = useRef(layout.aiOpen);
  useEffect(() => {
    if (mobile && layout.aiOpen && !initialAi.current) setMobileRightOpen(true);
    initialAi.current = false;
  }, [mobile, layout.aiOpen]);

  const toggleLeft = mobile ? () => setDrawerOpen((v) => !v) : layout.toggleLeft;
  const toggleRight = mobile ? () => setMobileRightOpen((v) => !v) : layout.toggleRight;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setSearching((v) => !v);
      } else if (key === 'j') {
        event.preventDefault();
        layout.setAiOpen(!layout.aiOpen);
      } else if (key === '\\') {
        event.preventDefault();
        if (event.shiftKey) toggleRight();
        else toggleLeft();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleLeft, toggleRight, layout]);

  const hasRight = layout.sidebar.length > 0 || layout.aiOpen;
  const leftVisible = mobile ? drawerOpen : layout.leftOpen;
  const rightVisible = hasRight && (mobile ? mobileRightOpen : layout.rightOpen);

  return (
    <div className="flex h-full">
      {leftVisible &&
        (mobile ? (
          <div className="fixed inset-0 z-40 flex">
            <Sidebar />
            <button type="button" aria-label="关闭侧栏" className="flex-1 bg-ink/30" onClick={() => setDrawerOpen(false)} />
          </div>
        ) : (
          <Sidebar />
        ))}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          leftOpen={leftVisible}
          rightOpen={rightVisible}
          rightCount={layout.sidebar.length}
          aiOpen={layout.aiOpen}
          onToggleAi={() => {
            layout.setAiOpen(!layout.aiOpen);
            if (mobile && !layout.aiOpen) setMobileRightOpen(true);
          }}
          onToggleLeft={toggleLeft}
          onToggleRight={toggleRight}
          onSearch={() => setSearching(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 pt-5 pb-40 md:px-10 md:pt-8">
            <Outlet />
          </div>
        </main>
      </div>
      {rightVisible && <RightSidebar overlay={mobile} onHide={toggleRight} />}
      {searching && <SearchDialog onClose={() => setSearching(false)} />}
      {mobile && <MobileEditToolbar />}
    </div>
  );
}
