'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Notebook, UserRole } from '@/lib/types';
import {
  BookOpen,
  Plus,
  Share2,
  ArrowRightLeft,
  ShieldCheck,
  FolderOpen,
  Sun,
  Moon,
  Lock,
  Check,
  ChevronDown,
  Pencil,
  Layers,
  Trash2,
} from 'lucide-react';

interface HeaderProps {
  notebooks: Notebook[];
  activeNotebook: Notebook;
  userRole: UserRole;
  onSelectNotebook: (id: string) => void;
  onOpenNewNotebook: () => void;
  onOpenMigration: () => void;
  onOpenShareExport: () => void;
  onRenameNotebook?: (id: string, newTitle: string) => void;
  onOpenEditNotebook?: (notebook: Notebook) => void;
  onDeleteNotebook?: (id: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isSourcesOpen?: boolean;
  onToggleSources?: () => void;
  isNotesOpen?: boolean;
  onToggleNotes?: () => void;
}

export function Header({
  notebooks,
  activeNotebook,
  userRole,
  onSelectNotebook,
  onOpenNewNotebook,
  onOpenMigration,
  onOpenShareExport,
  onRenameNotebook,
  onOpenEditNotebook,
  onDeleteNotebook,
  theme,
  onToggleTheme,
  isSourcesOpen = true,
  onToggleSources,
  isNotesOpen = true,
  onToggleNotes,
}: HeaderProps) {
  const activeSourcesCount = activeNotebook.sources.filter((s) => s.enabled).length;
  const isReadOnly = userRole === 'viewer';

  // Dropdown tray state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand & Notebook Selector */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shadow-xs shrink-0">
              <span className="text-base sm:text-lg">{activeNotebook.emoji || '📓'}</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight block">
                ATNotebook
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
                {isReadOnly ? 'Acesso Leitor' : 'Caderno de Fontes'}
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block mx-0.5 sm:mx-1" />

          {/* Notebook Selector & Centralized Edit Button */}
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0" ref={dropdownRef}>
            {isReadOnly ? (
              /* Clean Read-Only Notebook Badge for Reader Role */
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-lg py-1.5 px-3 shadow-2xs">
                <span className="text-sm shrink-0 leading-none">{activeNotebook.emoji || '📓'}</span>
                <span className="truncate max-w-[180px] xs:max-w-[260px] sm:max-w-[380px]" title={activeNotebook.title}>
                  {activeNotebook.title}
                </span>
                <span className="hidden xs:inline-flex text-[10px] font-medium text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/80 px-1.5 py-0.5 rounded">
                  Leitor
                </span>
              </div>
            ) : (
              /* Custom Dropdown Trigger with Aligned Arrow */
              <div className="relative">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-2.5 sm:px-3 focus:outline-hidden transition-colors cursor-pointer max-w-[170px] xs:max-w-[230px] sm:max-w-[320px] shadow-2xs group"
                    title={`Caderno ativo: ${activeNotebook.title}. Clique para trocar de caderno.`}
                  >
                    <span className="text-sm shrink-0 leading-none">{activeNotebook.emoji || '📓'}</span>
                    <span className="truncate leading-normal" title={activeNotebook.title}>
                      {activeNotebook.title}
                    </span>
                    <span className="hidden xs:inline-flex text-[11px] font-normal text-slate-500 dark:text-slate-400 shrink-0">
                      ({activeNotebook.sources.length} {activeNotebook.sources.length === 1 ? 'fonte' : 'fontes'})
                    </span>
                    {/* Aligned Dropdown Arrow with Smooth Rotation */}
                    <span className="flex items-center justify-center shrink-0 ml-0.5">
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                          isDropdownOpen ? 'rotate-180 text-slate-900 dark:text-slate-100' : ''
                        }`}
                      />
                    </span>
                  </button>

                  {/* Centralized Edit Button for Active Notebook (Opens complete details modal) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      if (onOpenEditNotebook) {
                        onOpenEditNotebook(activeNotebook);
                      }
                    }}
                    title="Editar detalhes do caderno ativo"
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dropdown Tray */}
                {isDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 xs:w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                    {/* Tray Header */}
                    <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                          Seus Cadernos
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-300/50 dark:border-slate-600">
                        {notebooks.length} {notebooks.length === 1 ? 'caderno' : 'cadernos'}
                      </span>
                    </div>

                    {/* Tray List of Notebooks */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-1.5 space-y-0.5">
                      {notebooks.map((nb) => {
                        const isActive = nb.id === activeNotebook.id;
                        return (
                          <div
                            key={nb.id}
                            className={`group flex items-center justify-between gap-2 p-2.5 rounded-lg transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50 ring-1 ring-slate-300/50 dark:ring-slate-700'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                            }`}
                            onClick={() => {
                              onSelectNotebook(nb.id);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="text-base shrink-0 select-none">{nb.emoji || '📓'}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-semibold truncate ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                                    {nb.title}
                                  </span>
                                  {isActive && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded shrink-0 shadow-2xs">
                                      Ativo
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-300 block truncate font-normal">
                                  {nb.sources.length} {nb.sources.length === 1 ? 'fonte' : 'fontes'} · {nb.sections.length} {nb.sections.length === 1 ? 'seção' : 'seções'}
                                </span>
                              </div>
                            </div>

                            {/* Actions on Item: Delete extra notebook, checkmark for active (no redundant pencil) */}
                            <div className="flex items-center gap-1 shrink-0">
                              {onDeleteNotebook && notebooks.length > 1 && !isActive && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Deseja excluir o caderno "${nb.title}"?`)) {
                                      onDeleteNotebook(nb.id);
                                    }
                                  }}
                                  title={`Excluir caderno "${nb.title}"`}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isActive && (
                                <Check className="w-4 h-4 text-slate-900 dark:text-slate-100 shrink-0 ml-0.5" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tray Footer Actions: Clean and focused on creating new notebooks */}
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onOpenNewNotebook();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 px-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Criar Novo Caderno</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isReadOnly && (
              <button
                onClick={onOpenNewNotebook}
                title="Criar novo caderno"
                className="p-1 sm:p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Center / Stats (desktop - hidden for reader) */}
        {!isReadOnly && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {activeSourcesCount}/{activeNotebook.sources.length} fontes ativas
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeNotebook.sections.length} seções</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {!isReadOnly && (
            <>
              {/* Migration Assistant Button for Gemini Notebook */}
              <button
                onClick={onOpenMigration}
                className="flex items-center gap-1 sm:gap-1.5 text-xs font-medium py-1.5 px-2.5 sm:px-3 rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
                title="Importar cadernos e fontes do Gemini Notebook"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="hidden xs:inline">Importar Caderno</span>
                <span className="xs:hidden">Importar</span>
              </button>

              {/* Export / Share Button for this specific notebook */}
              <button
                onClick={onOpenShareExport}
                className="flex items-center gap-1 sm:gap-1.5 text-xs font-medium py-1.5 px-2 sm:px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Compartilhar ou exportar este caderno"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" />
                <span className="hidden sm:inline">Compartilhar</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
