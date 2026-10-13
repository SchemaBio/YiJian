# CNV baseline sample selection and task operation colors

CNV baseline creation selects a complete sample pair with one checkbox. Each option shows the sample identifier and both FASTQ filenames. Data identifiers take precedence; untagged data can pair through recognized FASTQ filenames, preserving lane and chunk identifiers. Incomplete, duplicate, expired or ambiguous pairs cannot be selected. The submit handler revalidates the selection and derives both read arrays from the same ordered pairs; pricing uses both files in each pair.

The alternatives of independently choosing reads or inferring pairs from selection order allow accidental mismatches. A single paired selection prevents this while retaining the existing backend contract. Ambiguous data must first be organized in the data center.

Task center retry uses amber and interpretation uses violet, with corresponding lighter colors in dark mode. Hover retains each color. All other operations, including details, edit and delete, retain their original styles. Disabled actions keep the shared disabled appearance.

Validation covers pair inference, duplicate/missing/expired data, lane mismatches, reversed selection order and the baseline submission payload. Run the existing page regression tests and TypeScript checks before committing and deploying the frontend.
