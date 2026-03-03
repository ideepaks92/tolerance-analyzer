const THEORY_LINKS = [
  {
    title: "ASME Y14.5-2018",
    url: "https://www.asme.org/codes-standards/find-codes-standards/y14-5-dimensioning-tolerancing",
    note: "The definitive U.S. standard for GD&T",
  },
  {
    title: "ISO 8015 \u2014 GPS Fundamentals",
    url: "https://www.iso.org/standard/63999.html",
    note: "International tolerancing standard",
  },
  {
    title: "Drake \u2014 Dimensioning & Tolerancing Handbook",
    url: "https://www.amazon.com/Dimensioning-Tolerancing-Handbook-Paul-Drake/dp/0070181314",
    note: "Comprehensive tolerance analysis reference",
  },
  {
    title: "Creveling \u2014 Tolerance Design",
    url: "https://www.amazon.com/Tolerance-Design-Handbook-Developing-Manufacture/dp/0201634732",
    note: "RSS, Monte Carlo, and Six Sigma methods",
  },
];

const PROCESS_LINKS = [
  { process: "CNC Milling", tol: "\u00b10.025 mm", url: "https://weldomachining.com/cnc-machining-tolerances/" },
  { process: "CNC Lathe", tol: "\u00b10.025 mm", url: "https://ecoreprap.com/blog/cnc-machining-tolerance/" },
  { process: "Injection Molding", tol: "\u00b10.100 mm", url: "https://kehuimold.com/plastic-injection-molding-tolerance-standards/" },
  { process: "Elastomer Overmold", tol: "\u00b10.250 mm", url: "https://www.martins-rubber.co.uk/technical-references/rubber-tolerances/" },
  { process: "Metal Extrusion", tol: "\u00b10.125 mm", url: "https://www.engineersedge.com/manufacturing/aluminum_extrusion_dimensions_and_tolerances_specification_13072.htm" },
  { process: "Metal Casting", tol: "\u00b10.400 mm", url: "https://www.modulusmetal.com/iso-8062-3-casting-dimensional-and-geometrical-tolerance-calculator/" },
  { process: "Casting + Post CNC", tol: "\u00b10.050 mm", url: "https://castingquality.com/casting-technology/casting-standard/iso-8062-1994-castings.html" },
  { process: "3D Print (FDM)", tol: "\u00b10.200 mm", url: "https://wiki.bambulab.com/en/bambu-studio/ksrFDMTest" },
];

export default function ReferencesSection() {
  return (
    <div className="card px-5 py-4">
      <h3 className="text-sm font-bold text-navy-600 dark:text-gold-400 uppercase tracking-wider mb-3">
        References &amp; Resources
      </h3>
      <div className="max-h-52 overflow-y-auto pr-1">
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Theory */}
          <div>
            <h4 className="text-xs font-bold text-navy-600 dark:text-forest-200 uppercase tracking-wider mb-2">
              Tolerance Analysis Theory
            </h4>
            <ul className="space-y-1.5">
              {THEORY_LINKS.map((l) => (
                <li key={l.url} className="text-sm leading-snug">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy-600 dark:text-gold-400 hover:underline font-medium"
                  >
                    {l.title}
                  </a>
                  <span className="text-navy-400 dark:text-forest-400 ml-1">
                    &mdash; {l.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Process Defaults */}
          <div>
            <h4 className="text-xs font-bold text-navy-600 dark:text-forest-200 uppercase tracking-wider mb-2">
              Default Tolerance Sources
            </h4>
            <ul className="space-y-1.5">
              {PROCESS_LINKS.map((p) => (
                <li key={p.process} className="text-sm leading-snug">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy-600 dark:text-gold-400 hover:underline font-medium"
                  >
                    {p.process} ({p.tol})
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
