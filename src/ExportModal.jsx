import { TEAM_COLORS } from './constants';

function generateFlowText(args, speakers, motion, teamNames) {
  let text = `BP FLOW\n${'='.repeat(40)}\n`;
  text += `Motion: ${motion}\n`;
  text += `Date: ${new Date().toLocaleDateString()}\n\n`;

  for (const sp of speakers) {
    const spArgs = args.filter(a => a.speakerIndex === sp.order - 1 && !a.isJudgeNote);
    if (spArgs.length === 0) continue;

    text += `--- ${sp.role} (${teamNames[sp.team]}) ---\n`;
    for (const arg of spArgs) {
      let line = `  `;
      if (arg.isPOI) line += '[POI] ';
      if (arg.isExtension) line += '[EXT] ';
      if (arg.isWeighing) line += '[WEIGH] ';
      if (arg.clashTheme) line += `(${arg.clashTheme}) `;
      line += arg.claim || arg.text;

      if (arg.respondsTo) {
        const target = args.find(a => a.id === arg.respondsTo);
        if (target) {
          const targetText = target.claim || target.text;
          let linkNote = `resp to ${target.speaker}: "${targetText.slice(0, 30)}..."`;
          if (arg.rebuttalTarget) {
            linkNote = `attacks ${arg.rebuttalTarget.toUpperCase()} of ${target.speaker}: "${targetText.slice(0, 30)}..."`;
          }
          line += ` [${linkNote}]`;
        }
      }
      text += line + '\n';

      // Structured sub-lines for mechanisms, impacts, refutations
      const mechanisms = arg.mechanisms || (arg.mechanism ? [arg.mechanism] : []);
      const impacts = arg.impacts || (arg.impact ? [arg.impact] : []);
      const refutations = arg.refutations || [];
      for (const m of mechanisms) {
        text += `    M: ${m}\n`;
      }
      for (const imp of impacts) {
        text += `    I: ${imp}\n`;
      }
      for (const r of refutations) {
        text += `    R: ${r}\n`;
      }
    }
    text += '\n';
  }

  return text;
}

export default function ExportModal({ args, speakers, motion, teamNames, onClose }) {
  const handleCopyText = () => {
    const text = generateFlowText(args, speakers, motion, teamNames);
    navigator.clipboard.writeText(text).then(() => {
      alert('Flow copied to clipboard!');
    });
  };

  const handleExportPDF = () => {
    const text = generateFlowText(args, speakers, motion, teamNames);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `british-parliamentary-flow-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportClashMap = () => {
    // Export SVG as image
    const svg = document.querySelector('svg');
    if (!svg) {
      alert('Switch to Clash Map view first to export it.');
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clash-map-${new Date().toISOString().slice(0, 10)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 rounded-xl border"
        style={{ background: '#1a1d27', borderColor: '#2e3245' }}
        onClick={e => e.stopPropagation()}
      >
        <h3
          className="text-lg font-bold mb-4"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          Export
        </h3>

        <div className="space-y-2">
          <button
            onClick={handleExportPDF}
            className="w-full p-3 rounded-lg border text-left text-sm transition-colors hover:opacity-90"
            style={{ background: '#222533', borderColor: '#2e3245' }}
          >
            <div className="font-medium">Export as Text File</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
              Flow, arguments, and structure as plain text
            </div>
          </button>

          <button
            onClick={handleExportClashMap}
            className="w-full p-3 rounded-lg border text-left text-sm transition-colors hover:opacity-90"
            style={{ background: '#222533', borderColor: '#2e3245' }}
          >
            <div className="font-medium">Export Clash Map as SVG</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
              Visual clash map for sharing
            </div>
          </button>

          <button
            onClick={handleCopyText}
            className="w-full p-3 rounded-lg border text-left text-sm transition-colors hover:opacity-90"
            style={{ background: '#222533', borderColor: '#2e3245' }}
          >
            <div className="font-medium">Copy to Clipboard</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
              Formatted text for pasting
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 rounded-lg text-xs transition-colors"
          style={{ background: '#2e3245', color: '#94a3b8' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
