# CNV baseline sample selection and task operation colors

CNV baseline creation selects a complete sample pair with one checkbox. Each option shows the sample identifier and both FASTQ filenames. Data identifiers take precedence; untagged data can pair through recognized FASTQ filenames, preserving lane and chunk identifiers. Incomplete, duplicate, expired or ambiguous pairs cannot be selected. The submit handler revalidates the selection and derives both read arrays from the same ordered pairs; pricing uses both files in each pair.

The alternatives of independently choosing reads or inferring pairs from selection order allow accidental mismatches. A single paired selection prevents this while retaining the existing backend contract. Ambiguous data must first be organized in the data center.

Task center row actions use separate colors: start green, cancel orange, wait slate, interpret violet, completed teal, retry amber, details blue, edit cyan and delete red. Hover states retain their action color, dark mode uses corresponding lighter colors, and disabled actions keep the shared disabled appearance. Scope these styles to the task center so other tables retain their current styling.

Validation covers pair inference, duplicate/missing/expired data, lane mismatches, reversed selection order and the baseline submission payload. Run the existing page regression tests and TypeScript checks before committing and deploying the frontend.
