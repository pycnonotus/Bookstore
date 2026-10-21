export default function SaveToggle({ title, value, onChange }) {
  return <button type="button" aria-label={`${value ? 'Unsave' : 'Save'} ${title}`} aria-pressed={value}
    onClick={() => onChange(!value)}
    className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${value ? 'border-spruce bg-spruce text-white' : 'border-spruce/30 text-spruce hover:bg-spruce/10'}`}>
    {value ? 'Saved ✓' : 'Save +'}
  </button>;
}
