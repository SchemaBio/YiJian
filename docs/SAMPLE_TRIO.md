# Sample-based parent-child analysis

Parent relationships are edited in sample creation/editing and the sample detail
family tab. The sample list shows father/mother internal IDs and their optional
affected states. Missing parents can be saved and linked after their samples are
created. Blank state means unknown. The former pedigree page redirects to samples.

Both analysis creation entrypoints select a proband from paginated samples with
configured parents. The submission summary shows all three members, parent
statuses and FASTQ readiness. It explicitly treats the proband as affected.
Server-side preflight and task admission validate the same inputs. Historical
task summaries display the captured member snapshot, including carrier status.

Sample import accepts the old six columns and the new ten-column localized
templates. Task import uses the proband's sample identifier and no longer needs a
pedigree column; older pedigree-based workbooks remain compatible.

Requires the Octopus sample-parent API/migration release. Deploy backend first,
then frontend. This replaces the temporary remote `trio-test.override.yaml`
release; production builds no longer need the temporary family availability flags.
Deploying this change alone does not start any compute tasks.
