import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pin, 
  Board, 
  Website, 
  PinterestAccount, 
  AppSettings, 
  ActiveTab, 
  PublishQueueItem,
  AiQueueState
} from './types';
import { dbService } from './services/db';
import { exportPinsToCSV } from './services/csvEngine';
import { downloadPinsAsZip } from './services/zipExport';
import { publishQueue } from './services/publishEngine';
import { aiMetadataQueue } from './services/aiMetadataEngine';
import { pinterestService } from './services/pinterestApi';

// Components
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/Dashboard/DashboardView';
import { MassUploadView } from './components/Upload/MassUploadView';
import { PinLibraryView } from './components/Library/PinLibraryView';
import { ScheduleView } from './components/Schedule/ScheduleView';
import { AnalyticsView } from './components/Analytics/AnalyticsView';
import { WebsitesView } from './components/Websites/WebsitesView';
import { BoardsView } from './components/Boards/BoardsView';
import { SettingsView } from './components/Settings/SettingsView';
import { PublishingAssistantView } from './components/Assistant/PublishingAssistantView';
import { BulkImageCleanerView } from './components/ImageCleaner/BulkImageCleanerView';
import { EbookBuilderView } from './components/Ebook/EbookBuilderView';
import { BulkWatermarkView } from './components/Watermark/BulkWatermarkView';

// Modals & Tools
import { PinEditorModal } from './components/Editor/PinEditorModal';
import { BulkEditModal } from './components/Bulk/BulkEditModal';
import { AutoScheduleModal } from './components/Schedule/AutoScheduleModal';
import { CsvImportModal } from './components/CSV/CsvImportModal';
import { BulkExportModal } from './components/Bulk/BulkExportModal';
import { PublishQueueModal } from './components/Queue/PublishQueueModal';
import { WatermarkModal } from './components/Tools/WatermarkModal';
import { AspectRatioModal } from './components/Tools/AspectRatioModal';
import { UtmBuilderModal } from './components/Tools/UtmBuilderModal';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { AiQueueBanner } from './components/AI/AiQueueBanner';
import { AiCostConfirmModal } from './components/AI/AiCostConfirmModal';
import { NeonAmbientBackground } from './components/Effects/NeonAmbientBackground';

const THEME_STORAGE_KEY = 'pin_publisher_theme';
const SIDEBAR_COLLAPSED_KEY = 'pin_publisher_sidebar_collapsed';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar Collapsed State for maximizing space in split view
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  }, []);

  // Global keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
          return;
        }
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebarCollapse]);

  // Global Drag & Drop Protection:
  // Prevents the browser from navigating to dropped image files/URLs which would unload the React app
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleWindowDrop = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      // If dropped outside an explicit dropzone, prevent default browser file opening/navigation
      const isDropZone = target?.closest('[data-dropzone="true"], input[type="file"]');
      if (!isDropZone) {
        e.preventDefault();
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Sync dark class to <html> element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      } catch (e) {
        // ignore
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
      } catch (e) {
        // ignore
      }
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Core Data State
  const [pins, setPins] = useState<Pin[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [pinterestAccount, setPinterestAccount] = useState<PinterestAccount | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    timezone: 'America/New_York',
    defaultBoardId: '',
    defaultWebsiteId: '',
    defaultPublishingTimes: ['09:00', '13:00', '18:00'],
    pinterestClientId: '',
    pinterestClientSecret: '',
    pinterestAccessToken: '',
    autoScheduleIntervalDays: 7,
    aiModel: 'gemini-3.5-flash-lite',
    aiLanguage: 'English',
    autoStartAiOnUpload: true,
  });

  // AI Queue State
  const [aiState, setAiState] = useState<AiQueueState>(aiMetadataQueue.getState());
  const [isAiConfirmOpen, setIsAiConfirmOpen] = useState(false);
  const [aiTargetPins, setAiTargetPins] = useState<Pin[]>([]);

  // Modals state
  const [editingPin, setEditingPin] = useState<Pin | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [bulkTargetPins, setBulkTargetPins] = useState<Pin[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);

  const [autoScheduleTargetPins, setAutoScheduleTargetPins] = useState<Pin[]>([]);
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);

  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
  const [bulkExportTargetPins, setBulkExportTargetPins] = useState<Pin[] | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [queueItems, setQueueItems] = useState<PublishQueueItem[]>([]);

  // New Power Tool Modals
  const [isWatermarkOpen, setIsWatermarkOpen] = useState(false);
  const [watermarkTargetPins, setWatermarkTargetPins] = useState<Pin[]>([]);

  const [isAspectRatioOpen, setIsAspectRatioOpen] = useState(false);
  const [aspectRatioTargetPins, setAspectRatioTargetPins] = useState<Pin[]>([]);

  const [isUtmBuilderOpen, setIsUtmBuilderOpen] = useState(false);
  const [utmTargetPins, setUtmTargetPins] = useState<Pin[]>([]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Initial Load from IndexedDB
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedPins, loadedBoards, loadedWebsites, loadedAccount, loadedSettings] = await Promise.all([
          dbService.getAllPins(),
          dbService.getAllBoards(),
          dbService.getAllWebsites(),
          dbService.getPinterestAccount(),
          dbService.getSettings(),
        ]);

        setPins(loadedPins);
        setBoards(loadedBoards);
        setWebsites(loadedWebsites);
        setPinterestAccount(loadedAccount);
        setSettings(loadedSettings);

        // Auto-check Pinterest connection from environment if configured
        try {
          const configStatus = await pinterestService.checkConfigStatus();
          if (configStatus.hasToken) {
            const liveAccount = await pinterestService.fetchUserProfile();
            setPinterestAccount(liveAccount);
            await dbService.savePinterestAccount(liveAccount);

            try {
              const liveBoards = await pinterestService.fetchBoards();
              if (liveBoards.length > 0) {
                setBoards(liveBoards);
                await dbService.saveBoards(liveBoards);
              }
            } catch (boardErr) {
              console.warn('[App] Could not fetch boards on startup:', boardErr);
            }
          }
        } catch (pinErr: any) {
          console.warn('[App] Pinterest status check warning:', pinErr?.message);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }

    loadData();

    // Subscribe to Publishing Queue updates
    const unsubscribePublish = publishQueue.subscribe((items) => {
      setQueueItems(items);
    });

    // Subscribe to AI Metadata Queue updates
    const unsubscribeAi = aiMetadataQueue.subscribe((state) => {
      setAiState(state);
    });

    return () => {
      unsubscribePublish();
      unsubscribeAi();
    };
  }, []);

  // Update pin callback from publishing engine, AI queue, or editors
  const handlePinUpdated = useCallback((updatedPin: Pin) => {
    setPins(prev => {
      const idx = prev.findIndex(p => p.id === updatedPin.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = updatedPin;
      return copy;
    });
  }, []);

  // Save updated pin to state and IndexedDB
  const handleUpdatePin = async (pin: Pin) => {
    await dbService.savePin(pin);
    handlePinUpdated(pin);
  };

  // Bulk update pins
  const handleBatchPinsUpdated = async (updatedPins: Pin[]) => {
    await dbService.savePins(updatedPins);
    setPins(prev => {
      const map = new Map(updatedPins.map(p => [p.id, p]));
      return prev.map(p => map.get(p.id) || p);
    });
  };

  // Direct Delete pins (no blocking confirm)
  const handleDeletePins = async (ids: string[]) => {
    if (ids.length === 0) return;
    await dbService.deletePins(ids);
    aiMetadataQueue.removePinsFromQueue(ids);
    publishQueue.removePinFromQueue(ids);
    setPins(prev => prev.filter(p => !ids.includes(p.id)));
  };

  // Start AI Queue after confirmation
  const handleStartAiQueue = (targetPins: Pin[], customPrompt?: string) => {
    setIsAiConfirmOpen(false);
    setAiTargetPins([]);
    aiMetadataQueue.enqueuePins(
      targetPins,
      settings.aiLanguage || 'English',
      handlePinUpdated,
      settings.aiMinDelaySeconds ?? 15,
      settings.aiMaxDelaySeconds ?? 30,
      customPrompt
    );
  };

  const handleOpenAiConfirm = (targetPins: Pin[]) => {
    setAiTargetPins(targetPins);
    setIsAiConfirmOpen(true);
  };

  const handleRetryAiPin = (pin: Pin) => {
    aiMetadataQueue.enqueuePins(
      [pin],
      settings.aiLanguage || 'English',
      handlePinUpdated,
      settings.aiMinDelaySeconds ?? 15,
      settings.aiMaxDelaySeconds ?? 30
    );
  };

  // Publish pins
  const handlePublishPins = (targetPins: Pin[]) => {
    publishQueue.enqueuePins(targetPins, pinterestAccount, handlePinUpdated);
    setIsQueueOpen(true);
  };

  // Export to CSV - opens Bulk Export dialog with validation & 1-click download
  const handleExportCsv = (targetPins?: Pin[]) => {
    setBulkExportTargetPins(targetPins && targetPins.length > 0 ? targetPins : null);
    setIsBulkExportOpen(true);
  };

  // Download ZIP
  const handleDownloadZip = (targetPins: Pin[]) => {
    downloadPinsAsZip(targetPins, boards);
  };

  // Mass Upload Callback
  const handlePinsCreated = async (newPins: Pin[]) => {
    try {
      await dbService.savePins(newPins);
    } catch (e) {
      console.warn('Could not save new pins to database:', e);
    }
    setPins(prev => [...newPins, ...prev]);
    setActiveTab('library');

    if (settings.autoStartAiOnUpload) {
      handleOpenAiConfirm(newPins);
    }
  };

  // Import Pins Callback
  const handleImportPinsFromCsv = async (importedPins: Pin[], newBoards?: Board[]) => {
    if (newBoards && newBoards.length > 0) {
      await Promise.all(newBoards.map(b => dbService.saveBoard(b)));
      setBoards(prev => {
        const existingMap = new Map(prev.map(b => [b.id, b]));
        newBoards.forEach(b => existingMap.set(b.id, b));
        return Array.from(existingMap.values());
      });
    }
    await dbService.savePins(importedPins);
    setPins(prev => [...importedPins, ...prev]);
    setIsCsvImportOpen(false);
    setActiveTab('library');
  };

  // Reset demo data
  const handleResetAllData = async () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleClearAllPins = async () => {
    const ids = pins.map(p => p.id);
    await dbService.deletePins(ids);
    aiMetadataQueue.removePinsFromQueue(ids);
    publishQueue.removePinFromQueue(ids);
    setPins([]);
  };

  // Trigger Watermark for all or selected
  const openWatermarkModal = (targetPins?: Pin[]) => {
    setWatermarkTargetPins(targetPins && targetPins.length > 0 ? targetPins : pins);
    setIsWatermarkOpen(true);
  };

  // Trigger Aspect Ratio for all or selected
  const openAspectRatioModal = (targetPins?: Pin[]) => {
    setAspectRatioTargetPins(targetPins && targetPins.length > 0 ? targetPins : pins);
    setIsAspectRatioOpen(true);
  };

  // Trigger UTM Builder for all or selected
  const openUtmBuilderModal = (targetPins?: Pin[]) => {
    setUtmTargetPins(targetPins && targetPins.length > 0 ? targetPins : pins);
    setIsUtmBuilderOpen(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FB] dark:bg-black font-sans text-slate-800 dark:text-slate-100 antialiased transition-colors selection:bg-[#E60023] selection:text-white relative">
      {/* Floating & Movement Neon Ambiance Background */}
      <NeonAmbientBackground isDarkMode={isDarkMode} />

      {/* Bento Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalPinsCount={pins.length}
        draftsCount={pins.filter(p => p.status === 'draft').length}
        scheduledCount={pins.filter(p => p.status === 'scheduled').length}
        assistantCount={pins.filter(p => p.status !== 'published').length}
        pinterestAccount={pinterestAccount}
        onOpenUpload={() => setActiveTab('upload')}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8F9FB] dark:bg-black relative">
        {/* Subtle Ambient Radial Lighting for Dark Mode */}
        <div className="hidden dark:block absolute top-0 right-1/4 w-96 h-96 bg-[#E60023]/[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="hidden dark:block absolute bottom-10 left-1/4 w-96 h-96 bg-blue-500/[0.02] rounded-full blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            if (activeTab !== 'library' && activeTab !== 'assistant') setActiveTab('library');
          }}
          onOpenUpload={() => setActiveTab('upload')}
          onOpenCsvImport={() => setIsCsvImportOpen(true)}
          onExportCsv={handleExportCsv}
          onOpenQueue={() => setIsQueueOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenWatermark={() => openWatermarkModal()}
          onOpenAspectRatio={() => openAspectRatioModal()}
          onOpenUtmBuilder={() => openUtmBuilderModal()}
          queueItems={queueItems}
          pinterestAccount={pinterestAccount}
          onConnectPinterest={() => setActiveTab('settings')}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapse}
        />

        {/* Tab Views Container */}
        <main className="flex-1 flex flex-col p-6 sm:p-8 overflow-y-auto bg-[#F8F9FB] dark:bg-black transition-colors relative z-10">
          <div className="max-w-7xl w-full mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                {activeTab === 'dashboard' && (
                  <DashboardView
                    pins={pins}
                    boards={boards}
                    websites={websites}
                    pinterestAccount={pinterestAccount}
                    setActiveTab={setActiveTab}
                    onOpenUpload={() => setActiveTab('upload')}
                    onEditPin={(pin) => {
                      setEditingPin(pin);
                      setIsEditorOpen(true);
                    }}
                    onOpenAutoSchedule={(target) => {
                      setAutoScheduleTargetPins(target);
                      setIsAutoScheduleOpen(true);
                    }}
                    onPublishPin={(pin) => handlePublishPins([pin])}
                    onPublishPins={handlePublishPins}
                    onRefreshAccount={(acc, brds) => {
                      setPinterestAccount(acc);
                      setBoards(brds);
                    }}
                  />
                )}

                {activeTab === 'assistant' && (
                  <PublishingAssistantView
                    pins={pins}
                    boards={boards}
                    websites={websites}
                    onUpdatePin={handleUpdatePin}
                    onEditPin={(pin) => {
                      setEditingPin(pin);
                      setIsEditorOpen(true);
                    }}
                    onOpenUpload={() => setActiveTab('upload')}
                    onOpenAutoSchedule={(target) => {
                      setAutoScheduleTargetPins(target);
                      setIsAutoScheduleOpen(true);
                    }}
                    onOpenBulkEdit={(target) => {
                      setBulkTargetPins(target);
                      setIsBulkEditOpen(true);
                    }}
                    onRetryAiPin={handleRetryAiPin}
                    onOpenImportCsv={() => setIsCsvImportOpen(true)}
                    language={settings.aiLanguage || 'English'}
                  />
                )}

                {activeTab === 'upload' && (
                  <MassUploadView
                    onPinsCreated={handlePinsCreated}
                    boards={boards}
                    websites={websites}
                    defaultBoardId={settings.defaultBoardId}
                    defaultWebsiteId={settings.defaultWebsiteId}
                    onOpenBulkEdit={(target) => {
                      setBulkTargetPins(target);
                      setIsBulkEditOpen(true);
                    }}
                    onOpenAutoSchedule={(target) => {
                      setAutoScheduleTargetPins(target);
                      setIsAutoScheduleOpen(true);
                    }}
                    onOpenWatermark={(target) => openWatermarkModal(target)}
                    onOpenAspectRatio={(target) => openAspectRatioModal(target)}
                    onOpenUtmBuilder={(target) => openUtmBuilderModal(target)}
                  />
                )}

                {activeTab === 'ebook' && (
                  <EbookBuilderView
                    pins={pins}
                    boards={boards}
                    websites={websites}
                    defaultBoardId={settings.defaultBoardId}
                    defaultWebsiteId={settings.defaultWebsiteId}
                    onExportToPins={handlePinsCreated}
                    onOpenPinLibrary={() => setActiveTab('library')}
                  />
                )}

                {activeTab === 'cleaner' && (
                  <BulkImageCleanerView
                    onPinsCreated={handlePinsCreated}
                    defaultBoardId={settings.defaultBoardId}
                    defaultWebsiteId={settings.defaultWebsiteId}
                  />
                )}

                {activeTab === 'watermark' && (
                  <BulkWatermarkView
                    pins={pins}
                    boards={boards}
                    websites={websites}
                    onPinsCreated={handlePinsCreated}
                    defaultBoardId={settings.defaultBoardId}
                    defaultWebsiteId={settings.defaultWebsiteId}
                  />
                )}

                {activeTab === 'library' && (
                  <PinLibraryView
                    pins={pins}
                    boards={boards}
                    websites={websites}
                    searchQuery={searchQuery}
                    onUpdatePin={handleUpdatePin}
                    onDeletePins={handleDeletePins}
                    onEditPin={(pin) => {
                      setEditingPin(pin);
                      setIsEditorOpen(true);
                    }}
                    onRetryAiPin={handleRetryAiPin}
                    onOpenBulkEdit={(target) => {
                      setBulkTargetPins(target);
                      setIsBulkEditOpen(true);
                    }}
                    onOpenAutoSchedule={(target) => {
                      setAutoScheduleTargetPins(target);
                      setIsAutoScheduleOpen(true);
                    }}
                    onOpenWatermark={(target) => openWatermarkModal(target)}
                    onOpenAspectRatio={(target) => openAspectRatioModal(target)}
                    onOpenUtmBuilder={(target) => openUtmBuilderModal(target)}
                    onOpenAiConfirm={handleOpenAiConfirm}
                    onDownloadZip={handleDownloadZip}
                    onPublishPins={handlePublishPins}
                    onOpenUpload={() => setActiveTab('upload')}
                    onOpenAssistant={() => setActiveTab('assistant')}
                    onOpenImportCsv={() => setIsCsvImportOpen(true)}
                    onOpenBulkExport={() => setIsBulkExportOpen(true)}
                    onPinsUpdated={handleBatchPinsUpdated}
                    language={settings.aiLanguage || 'English'}
                  />
                )}

                {activeTab === 'schedule' && (
                  <ScheduleView
                    pins={pins}
                    boards={boards}
                    websites={websites}
                    onUpdatePin={handleUpdatePin}
                    onEditPin={(pin) => {
                      setEditingPin(pin);
                      setIsEditorOpen(true);
                    }}
                    onOpenAutoSchedule={(target) => {
                      setAutoScheduleTargetPins(target);
                      setIsAutoScheduleOpen(true);
                    }}
                    onOpenUpload={() => setActiveTab('upload')}
                    onPublishPin={(pin) => handlePublishPins([pin])}
                  />
                )}

                {activeTab === 'analytics' && (
                  <AnalyticsView
                    pins={pins}
                    boards={boards}
                    websites={websites}
                    onEditPin={(pin) => {
                      setEditingPin(pin);
                      setIsEditorOpen(true);
                    }}
                  />
                )}

                {activeTab === 'websites' && (
                  <WebsitesView
                    websites={websites}
                    pins={pins}
                    onSaveWebsite={async (web) => {
                      await dbService.saveWebsite(web);
                      setWebsites(prev => {
                        const idx = prev.findIndex(w => w.id === web.id);
                        if (idx >= 0) {
                          const copy = [...prev];
                          copy[idx] = web;
                          return copy;
                        }
                        return [...prev, web];
                      });
                    }}
                    onDeleteWebsite={async (id) => {
                      await dbService.deleteWebsite(id);
                      setWebsites(prev => prev.filter(w => w.id !== id));
                    }}
                  />
                )}

                {activeTab === 'boards' && (
                  <BoardsView
                    boards={boards}
                    pins={pins}
                    pinterestAccount={pinterestAccount}
                    onSaveBoard={async (board) => {
                      await dbService.saveBoard(board);
                      setBoards(prev => {
                        const idx = prev.findIndex(b => b.id === board.id);
                        if (idx >= 0) {
                          const copy = [...prev];
                          copy[idx] = board;
                          return copy;
                        }
                        return [...prev, board];
                      });
                    }}
                    onSaveBoards={async (newBoards) => {
                      await dbService.saveBoards(newBoards);
                      setBoards(newBoards);
                    }}
                    onDeleteBoard={async (id) => {
                      await dbService.deleteBoard(id);
                      setBoards(prev => prev.filter(b => b.id !== id));
                    }}
                    onConnectPinterest={() => setActiveTab('settings')}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    settings={settings}
                    pinterestAccount={pinterestAccount}
                    boards={boards}
                    websites={websites}
                    onSaveSettings={async (newSettings) => {
                      await dbService.saveSettings(newSettings);
                      setSettings(newSettings);
                    }}
                    onSavePinterestAccount={async (account) => {
                      await dbService.savePinterestAccount(account);
                      setPinterestAccount(account);
                    }}
                    onResetAllData={handleResetAllData}
                    onClearAllPins={handleClearAllPins}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={toggleDarkMode}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Persistent AI Queue Progress Banner */}
      <AiQueueBanner
        aiState={aiState}
        onPause={() => aiMetadataQueue.pauseQueue()}
        onResume={() => aiMetadataQueue.resumeQueue(
          pins, 
          settings.aiLanguage || 'English', 
          handlePinUpdated,
          settings.aiMinDelaySeconds ?? 15,
          settings.aiMaxDelaySeconds ?? 30
        )}
        onStop={() => aiMetadataQueue.stopQueue()}
        onSkipCooldown={() => aiMetadataQueue.skipCooldown()}
      />

      {/* AI Batch Cost & Run Confirmation Modal */}
      <AiCostConfirmModal
        pins={aiTargetPins}
        language={settings.aiLanguage || 'English'}
        minDelay={settings.aiMinDelaySeconds ?? 15}
        maxDelay={settings.aiMaxDelaySeconds ?? 30}
        initialCustomPrompt={settings.aiCustomPrompt || ''}
        isOpen={isAiConfirmOpen}
        onClose={() => {
          setIsAiConfirmOpen(false);
          setAiTargetPins([]);
        }}
        onConfirm={(customPrompt) => handleStartAiQueue(aiTargetPins, customPrompt)}
      />

      {/* MODALS */}
      {/* 1. Pin Editor Modal */}
      <PinEditorModal
        pin={editingPin}
        allPins={pins}
        boards={boards}
        websites={websites}
        timezone={settings.timezone}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingPin(null);
        }}
        onSave={handleUpdatePin}
        onPublish={(pin) => handlePublishPins([pin])}
        onDelete={(id) => handleDeletePins([id])}
        onSelectPin={(pin) => setEditingPin(pin)}
        language={settings.aiLanguage || 'English'}
      />

      {/* 2. Bulk Edit Modal */}
      <BulkEditModal
        selectedPins={bulkTargetPins}
        boards={boards}
        websites={websites}
        isOpen={isBulkEditOpen}
        onClose={() => {
          setIsBulkEditOpen(false);
          setBulkTargetPins([]);
        }}
        onApply={handleBatchPinsUpdated}
      />

      {/* 3. Auto Schedule Modal */}
      <AutoScheduleModal
        pins={autoScheduleTargetPins}
        boards={boards}
        websites={websites}
        defaultPublishingTimes={settings.defaultPublishingTimes}
        isOpen={isAutoScheduleOpen}
        onClose={() => {
          setIsAutoScheduleOpen(false);
          setAutoScheduleTargetPins([]);
        }}
        onApplySchedule={handleBatchPinsUpdated}
      />

      {/* 4. CSV Import Modal */}
      <CsvImportModal
        boards={boards}
        websites={websites}
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        onImportPins={handleImportPinsFromCsv}
      />

      {/* 4b. Bulk Export to CSV Modal */}
      <BulkExportModal
        pins={pins}
        targetPins={bulkExportTargetPins}
        boards={boards}
        isOpen={isBulkExportOpen}
        onClose={() => {
          setIsBulkExportOpen(false);
          setBulkExportTargetPins(null);
        }}
        onOpenImportCsv={() => {
          setIsBulkExportOpen(false);
          setBulkExportTargetPins(null);
          setIsCsvImportOpen(true);
        }}
        onPinsUpdated={handleBatchPinsUpdated}
      />

      {/* 5. Publishing Queue Drawer */}
      <PublishQueueModal
        queueItems={queueItems}
        boards={boards}
        pinterestAccount={pinterestAccount}
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onPinUpdated={handlePinUpdated}
      />

      {/* 6. Batch Watermark Modal */}
      <WatermarkModal
        pins={watermarkTargetPins}
        isOpen={isWatermarkOpen}
        onClose={() => {
          setIsWatermarkOpen(false);
          setWatermarkTargetPins([]);
        }}
        onApplyWatermark={handleBatchPinsUpdated}
      />

      {/* 7. Pinterest 2:3 Aspect Ratio Optimizer Modal */}
      <AspectRatioModal
        pins={aspectRatioTargetPins}
        isOpen={isAspectRatioOpen}
        onClose={() => {
          setIsAspectRatioOpen(false);
          setAspectRatioTargetPins([]);
        }}
        onApplyRatio={handleBatchPinsUpdated}
      />

      {/* 8. Bulk UTM Link Builder Modal */}
      <UtmBuilderModal
        pins={utmTargetPins}
        boards={boards}
        isOpen={isUtmBuilderOpen}
        onClose={() => {
          setIsUtmBuilderOpen(false);
          setUtmTargetPins([]);
        }}
        onApplyUtm={handleBatchPinsUpdated}
      />

      {/* 9. Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
        onOpenUpload={() => setActiveTab('upload')}
        onOpenAutoSchedule={() => {
          setAutoScheduleTargetPins(pins.filter(p => p.status === 'draft' || !p.scheduledAt));
          setIsAutoScheduleOpen(true);
        }}
        onOpenWatermark={() => openWatermarkModal()}
        onOpenAspectRatio={() => openAspectRatioModal()}
        onOpenUtmBuilder={() => openUtmBuilderModal()}
        onExportCsv={handleExportCsv}
        onOpenCsvImport={() => setIsCsvImportOpen(true)}
      />
    </div>
  );
}
