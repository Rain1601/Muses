"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  prompt: string;
  isPreset: boolean;
}

const CATEGORIES: { key: string; label: string; accent: string }[] = [
  { key: "meta",      label: "Meta",       accent: "#D97149" },
  { key: "opening",   label: "Opening",    accent: "#E9A476" },
  { key: "structure", label: "Structure",  accent: "#9AB6A4" },
  { key: "polish",    label: "Polish",     accent: "#C3B091" },
  { key: "style",     label: "Style",      accent: "#A89BC1" },
  { key: "general",   label: "General",    accent: "var(--m-n500)" },
];

const ALL_KEY = "all";

function categoryAccent(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.accent || "var(--m-n500)";
}

function categoryLabel(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.label || key;
}

function previewPrompt(prompt: string): string {
  const cleaned = prompt.replace(/^\s+/, "").split("\n").find(line => line.trim().length > 0) || "";
  return cleaned.slice(0, 110);
}

export default function SkillLibrary() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_KEY);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [search, setSearch] = useState("");

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/skills`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSkills(data.skills || []);
    } catch (e) { console.error("Load skills failed:", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const cloneSkill = async (skillId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/skills/${skillId}/clone`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("success", "已复制为可编辑副本");
        loadSkills();
      }
    } catch (e: any) { showToast("error", e.message || "复制失败"); }
  };

  const deleteSkill = async (skillId: string) => {
    if (!confirm("确认删除此 skill？")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/skills/${skillId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "已删除");
        loadSkills();
      } else {
        showToast("error", data.detail || "删除失败");
      }
    } catch (e: any) { showToast("error", e.message || "删除失败"); }
  };

  // Filter + group
  const filtered = useMemo(() => {
    let result = skills;
    if (activeCategory !== ALL_KEY) {
      result = result.filter(s => s.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.prompt.toLowerCase().includes(q)
      );
    }
    return result;
  }, [skills, activeCategory, search]);

  // Find Skill Creator for hero block
  const skillCreator = useMemo(() => skills.find(s => s.category === "meta" && /skill creator/i.test(s.name)), [skills]);

  // Group by category when showing all (no search)
  const grouped = useMemo(() => {
    if (activeCategory !== ALL_KEY || search.trim()) return null;
    const groups: Record<string, Skill[]> = {};
    filtered.forEach(s => {
      // Hide skill-creator from grid since it's the hero
      if (skillCreator && s.id === skillCreator.id) return;
      (groups[s.category] ||= []).push(s);
    });
    return groups;
  }, [filtered, activeCategory, search, skillCreator]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { [ALL_KEY]: skills.length };
    skills.forEach(s => { c[s.category] = (c[s.category] || 0) + 1; });
    return c;
  }, [skills]);

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>Skill Library</div>
          <div style={subtitleStyle}>可复用的写作 prompt 模板 · 预设 + 自定义</div>
        </div>
        <button onClick={() => setCreating(true)} style={primaryBtnStyle}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Skill
        </button>
      </div>

      {/* Skill Creator hero (only visible when "all" and no search and creator exists) */}
      {activeCategory === ALL_KEY && !search.trim() && skillCreator && (
        <div style={heroStyle} onClick={() => setEditingSkill(skillCreator)}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <span style={{ ...heroAccentStyle, background: categoryAccent("meta") }} />
            <span style={heroLabelStyle}>Built-in</span>
            <span style={heroDotStyle}>·</span>
            <span style={heroLabelStyle}>Meta</span>
          </div>
          <div style={heroTitleStyle}>{skillCreator.name}</div>
          <div style={heroDescStyle}>{skillCreator.description}</div>
          <div style={heroActionStyle}>
            Open <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
        </div>
      )}

      {/* Toolbar: search + category pills */}
      <div style={toolbarStyle}>
        <div style={searchWrapStyle}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "var(--m-n450)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search skills…"
            style={searchInputStyle}
          />
        </div>
        <div style={pillsRowStyle}>
          <button
            onClick={() => setActiveCategory(ALL_KEY)}
            style={activeCategory === ALL_KEY ? pillActiveStyle : pillStyle}
          >
            All <span style={pillCountStyle}>{counts[ALL_KEY] || 0}</span>
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              style={activeCategory === c.key ? { ...pillActiveStyle, borderColor: c.accent, color: "var(--m-n50)" } : pillStyle}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: c.accent, display: "inline-block", marginRight: "0.4375rem" }} />
              {c.label} <span style={pillCountStyle}>{counts[c.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div style={statusStyle}>加载中…</div>
      ) : filtered.length === 0 ? (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: "1.0625rem", color: "var(--m-n300)", marginBottom: "0.5rem", fontFamily: "'Times New Roman', Georgia, serif" }}>没有匹配的 skill</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--m-n400)", marginBottom: "1.25rem" }}>
            {search.trim() ? "试试别的关键词，或" : "你可以"}从空白创建，或让 Skill Creator 帮你设计。
          </div>
          <button onClick={() => setCreating(true)} style={primaryBtnStyle}>+ New Skill</button>
        </div>
      ) : grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {CATEGORIES.map(cat => {
            const items = grouped[cat.key] || [];
            if (items.length === 0) return null;
            return (
              <section key={cat.key}>
                <div style={sectionHeaderStyle}>
                  <span style={{ ...sectionAccentStyle, background: cat.accent }} />
                  <span style={sectionLabelStyle}>{cat.label}</span>
                  <span style={sectionCountStyle}>{items.length}</span>
                </div>
                <div style={gridStyle}>
                  {items.map(skill => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onOpen={() => setEditingSkill(skill)}
                      onClone={() => cloneSkill(skill.id)}
                      onDelete={() => deleteSkill(skill.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div style={gridStyle}>
          {filtered.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onOpen={() => setEditingSkill(skill)}
              onClone={() => cloneSkill(skill.id)}
              onDelete={() => deleteSkill(skill.id)}
            />
          ))}
        </div>
      )}

      {/* Edit / View modal */}
      {editingSkill && (
        <SkillEditor
          skill={editingSkill}
          onClose={() => setEditingSkill(null)}
          onSaved={() => { setEditingSkill(null); loadSkills(); showToast("success", "已保存"); }}
          onClone={() => { cloneSkill(editingSkill.id); setEditingSkill(null); }}
        />
      )}

      {/* Create modal */}
      {creating && (
        <SkillEditor
          skill={null}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); loadSkills(); showToast("success", "已创建"); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={toastStyle(toast.type)}>{toast.msg}</div>
      )}
    </div>
  );
}

// ===== Skill Card =====
interface SkillCardProps {
  skill: Skill;
  onOpen: () => void;
  onClone: () => void;
  onDelete: () => void;
}

function SkillCard({ skill, onOpen, onClone, onDelete }: SkillCardProps) {
  const [hovered, setHovered] = useState(false);
  const accent = categoryAccent(skill.category);

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...cardStyle,
        borderColor: hovered ? "var(--m-n600)" : "var(--m-n750)",
        background: hovered ? "rgba(41, 37, 36, 0.7)" : "transparent",
      }}
    >
      <div style={{ ...cardAccentBarStyle, background: accent, opacity: hovered ? 1 : 0.5 }} />
      <div style={cardBodyStyle}>
        <div style={cardTopRowStyle}>
          <span style={cardCategoryLabelStyle}>{categoryLabel(skill.category)}</span>
          <span style={skill.isPreset ? presetBadgeStyle : customBadgeStyle}>{skill.isPreset ? "preset" : "custom"}</span>
        </div>
        <div style={cardTitleStyle}>{skill.name}</div>
        <div style={cardDescStyle}>{skill.description || "—"}</div>
        <div style={cardPreviewStyle}>{previewPrompt(skill.prompt)}</div>
        <div style={cardFooterStyle} onClick={e => e.stopPropagation()}>
          <button onClick={onOpen} style={cardActionGhostStyle}>Open</button>
          {skill.isPreset ? (
            <button onClick={onClone} style={cardActionGhostStyle}>Clone</button>
          ) : (
            <button onClick={onDelete} style={cardActionDangerStyle}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Editor modal =====
interface SkillEditorProps {
  skill: Skill | null;
  onClose: () => void;
  onSaved: () => void;
  onClone?: () => void;
}

function SkillEditor({ skill, onClose, onSaved, onClone }: SkillEditorProps) {
  const isPreset = skill?.isPreset ?? false;
  const isCreate = skill === null;

  const [name, setName] = useState(skill?.name || "");
  const [description, setDescription] = useState(skill?.description || "");
  const [category, setCategory] = useState(skill?.category || "general");
  const [prompt, setPrompt] = useState(skill?.prompt || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !prompt.trim()) {
      setError("名称和 prompt 不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const body = { name: name.trim(), description: description.trim(), icon: skill?.icon || "📝", category, prompt: prompt.trim() };
      const url = isCreate ? `${API_BASE}/api/skills` : `${API_BASE}/api/skills/${skill!.id}`;
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) onSaved();
      else setError(data.detail || "保存失败");
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const accent = categoryAccent(category);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={editorPanelStyle} onClick={e => e.stopPropagation()}>
        <div style={{ ...editorAccentBarStyle, background: accent }} />
        <div style={editorHeaderStyle}>
          <div>
            <div style={editorEyebrowStyle}>
              {isCreate ? "Create" : isPreset ? "View preset" : "Edit"} · {categoryLabel(category)}
            </div>
            <div style={editorTitleStyle}>{name || "Untitled skill"}</div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={editorBodyStyle}>
          {isPreset && (
            <div style={presetNoticeStyle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>预设 skill 只读。复制一份后可自由修改。</span>
            </div>
          )}

          <label style={labelStyle}>名称</label>
          <input value={name} onChange={e => setName(e.target.value)} disabled={isPreset} style={inputStyle} placeholder="例如：故事化开头" />

          <label style={labelStyle}>描述</label>
          <input value={description} onChange={e => setDescription(e.target.value)} disabled={isPreset} style={inputStyle} placeholder="一句话说明用途" />

          <label style={labelStyle}>分类</label>
          <select value={category} onChange={e => setCategory(e.target.value)} disabled={isPreset} style={inputStyle}>
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>

          <label style={labelStyle}>Prompt · 支持 {`{占位符}`}</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={isPreset}
            style={{ ...inputStyle, minHeight: "220px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: 1.55, resize: "vertical" }}
            placeholder="把你的 prompt 写在这里…"
          />

          {error && <div style={{ color: "#fca5a5", fontSize: "0.75rem", marginTop: "0.625rem" }}>{error}</div>}
        </div>

        <div style={editorFooterStyle}>
          {isPreset ? (
            <button onClick={onClone} style={primaryBtnStyle}>Clone to edit</button>
          ) : (
            <button onClick={save} disabled={saving} style={primaryBtnStyle}>
              {saving ? "保存中…" : (isCreate ? "Create" : "Save")}
            </button>
          )}
          <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ===== Styles =====
const containerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  padding: "2.25rem 2.75rem 3rem",
  overflowY: "auto",
  maxWidth: "1080px",
  margin: "0 auto",
  width: "100%",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginBottom: "1.5rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.625rem",
  fontWeight: 600,
  color: "var(--m-n50)",
  fontFamily: "'Times New Roman', Georgia, serif",
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--m-n400)",
  marginTop: "0.375rem",
  letterSpacing: "0.01em",
};

// Hero (skill creator)
const heroStyle: React.CSSProperties = {
  position: "relative",
  padding: "1.25rem 1.5rem",
  background: "linear-gradient(135deg, rgba(217, 113, 73, 0.08), rgba(217, 113, 73, 0.02))",
  border: "1px solid rgba(217, 113, 73, 0.25)",
  borderRadius: "10px",
  cursor: "pointer",
  marginBottom: "1.5rem",
  transition: "all 0.2s ease",
};

const heroAccentStyle: React.CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "999px",
  display: "inline-block",
};

const heroLabelStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--m-n300)",
  fontWeight: 500,
};

const heroDotStyle: React.CSSProperties = {
  color: "var(--m-n750)",
  fontSize: "0.625rem",
};

const heroTitleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  color: "var(--m-n50)",
  fontFamily: "'Times New Roman', Georgia, serif",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  marginBottom: "0.375rem",
};

const heroDescStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--m-n300)",
  lineHeight: 1.55,
  maxWidth: "640px",
  marginBottom: "0.875rem",
};

const heroActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.75rem",
  color: "#D97149",
  fontWeight: 500,
};

// Toolbar
const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.875rem",
  marginBottom: "1.75rem",
  paddingBottom: "1.25rem",
  borderBottom: "1px solid var(--m-n880)",
};

const searchWrapStyle: React.CSSProperties = {
  position: "relative",
  maxWidth: "320px",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--m-n925)",
  border: "1px solid var(--m-n880)",
  borderRadius: "6px",
  padding: "0.4375rem 0.625rem 0.4375rem 1.875rem",
  color: "var(--m-n50)",
  fontSize: "0.75rem",
  fontFamily: "inherit",
  outline: "none",
};

const pillsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.375rem",
  flexWrap: "wrap",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "0.6875rem",
  padding: "0.3125rem 0.6875rem",
  borderRadius: "999px",
  border: "1px solid var(--m-n880)",
  background: "transparent",
  color: "var(--m-n400)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 500,
  letterSpacing: "0.01em",
  transition: "all 0.15s ease",
};

const pillActiveStyle: React.CSSProperties = {
  ...pillStyle,
  background: "rgba(41, 37, 36, 0.7)",
  border: "1px solid var(--m-n600)",
  color: "var(--m-n50)",
};

const pillCountStyle: React.CSSProperties = {
  marginLeft: "0.375rem",
  fontSize: "0.625rem",
  color: "var(--m-n450)",
};

// Section
const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  marginBottom: "0.875rem",
};

const sectionAccentStyle: React.CSSProperties = {
  width: "12px",
  height: "2px",
  borderRadius: "2px",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--m-n300)",
  fontWeight: 500,
};

const sectionCountStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "var(--m-n450)",
};

// Grid + Card
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "0.875rem",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: "10px",
  border: "1px solid var(--m-n750)",
  cursor: "pointer",
  transition: "all 0.18s ease",
  display: "flex",
  overflow: "hidden",
  minHeight: "180px",
};

const cardAccentBarStyle: React.CSSProperties = {
  width: "3px",
  flexShrink: 0,
  transition: "opacity 0.18s ease",
};

const cardBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: "0.875rem 1rem 0.75rem",
  display: "flex",
  flexDirection: "column",
};

const cardTopRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "0.5rem",
};

const cardCategoryLabelStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--m-n400)",
  fontWeight: 500,
};

const presetBadgeStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  padding: "0.0625rem 0.4rem",
  borderRadius: "3px",
  background: "rgba(245, 158, 11, 0.1)",
  color: "#d4a05f",
  fontWeight: 500,
  letterSpacing: "0.02em",
};

const customBadgeStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  padding: "0.0625rem 0.4rem",
  borderRadius: "3px",
  background: "rgba(154, 182, 164, 0.1)",
  color: "#9AB6A4",
  fontWeight: 500,
  letterSpacing: "0.02em",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontFamily: "'Times New Roman', Georgia, serif",
  fontWeight: 600,
  color: "var(--m-n50)",
  letterSpacing: "-0.01em",
  marginBottom: "0.375rem",
  lineHeight: 1.25,
};

const cardDescStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--m-n300)",
  lineHeight: 1.55,
  marginBottom: "0.625rem",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardPreviewStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "var(--m-n450)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  lineHeight: 1.45,
  marginBottom: "0.75rem",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  flex: 1,
};

const cardFooterStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.375rem",
  marginTop: "auto",
  paddingTop: "0.5rem",
  borderTop: "1px solid var(--m-n880)",
};

const cardActionGhostStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  padding: "0.25rem 0.625rem",
  borderRadius: "5px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--m-n300)",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s ease",
};

const cardActionDangerStyle: React.CSSProperties = {
  ...cardActionGhostStyle,
  color: "#9c8073",
};

// Buttons
const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.75rem",
  padding: "0.4375rem 0.875rem",
  borderRadius: "6px",
  border: "1px solid #D97149",
  background: "#D97149",
  color: "white",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 500,
};

const ghostBtnStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  padding: "0.4375rem 0.875rem",
  borderRadius: "6px",
  border: "1px solid var(--m-n750)",
  background: "transparent",
  color: "var(--m-n300)",
  cursor: "pointer",
  fontFamily: "inherit",
};

// Status / empty
const statusStyle: React.CSSProperties = {
  textAlign: "center",
  color: "var(--m-n400)",
  padding: "3rem 1rem",
  fontSize: "0.875rem",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "3rem 1rem",
};

// Modal (editor)
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.55)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const editorPanelStyle: React.CSSProperties = {
  position: "relative",
  width: "580px",
  maxWidth: "92vw",
  maxHeight: "88vh",
  background: "var(--m-n925)",
  border: "1px solid var(--m-n750)",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
};

const editorAccentBarStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "2px",
};

const editorHeaderStyle: React.CSSProperties = {
  padding: "1.125rem 1.375rem 1rem",
  borderBottom: "1px solid var(--m-n880)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
};

const editorEyebrowStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--m-n400)",
  marginBottom: "0.375rem",
  fontWeight: 500,
};

const editorTitleStyle: React.CSSProperties = {
  fontSize: "1.125rem",
  fontFamily: "'Times New Roman', Georgia, serif",
  fontWeight: 600,
  color: "var(--m-n50)",
  letterSpacing: "-0.01em",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--m-n400)",
  cursor: "pointer",
  padding: "0.25rem",
  display: "flex",
  alignItems: "center",
};

const editorBodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "1rem 1.375rem 1.25rem",
};

const editorFooterStyle: React.CSSProperties = {
  padding: "0.875rem 1.375rem",
  borderTop: "1px solid var(--m-n880)",
  display: "flex",
  gap: "0.5rem",
  justifyContent: "flex-end",
};

const presetNoticeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.5rem 0.75rem",
  background: "rgba(245, 158, 11, 0.06)",
  border: "1px solid rgba(245, 158, 11, 0.2)",
  borderRadius: "6px",
  fontSize: "0.75rem",
  color: "#d4a05f",
  marginBottom: "0.75rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.6875rem",
  color: "var(--m-n400)",
  marginBottom: "0.375rem",
  marginTop: "0.75rem",
  letterSpacing: "0.02em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--m-n880)",
  border: "1px solid var(--m-n750)",
  borderRadius: "6px",
  padding: "0.5rem 0.625rem",
  color: "var(--m-n50)",
  fontSize: "0.8125rem",
  fontFamily: "inherit",
  outline: "none",
};

const toastStyle = (type: "success" | "error"): React.CSSProperties => ({
  position: "fixed",
  bottom: "1.5rem",
  left: "50%",
  transform: "translateX(-50%)",
  padding: "0.5rem 0.875rem",
  borderRadius: "6px",
  fontSize: "0.75rem",
  background: type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
  color: type === "success" ? "#86efac" : "#fca5a5",
  border: `1px solid ${type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
  zIndex: 1100,
});
