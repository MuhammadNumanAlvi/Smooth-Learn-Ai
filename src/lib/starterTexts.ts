export interface StarterTextOption {
  title: string;
  category: string;
  fileName: string;
  content: string;
}

export const STARTER_TEXTS: StarterTextOption[] = [
  {
    title: 'Cognitive Neuroscience & Memory Systems',
    category: 'Neuroscience & Psychology',
    fileName: 'Cognitive_Neuroscience_Memory_Systems.txt',
    content: `CHAPTER 1: FOUNDATIONS OF MEMORY ARCHITECTURE
Memory is not a unitary faculty of the mind, but rather a complex system composed of distinct neural subsystems operating across different temporal scales and anatomical pathways.

1.1 Sensory Memory and Working Memory
Sensory memory acts as an ultra-short-term buffer holding exact sensory impressions for milliseconds (iconic memory for vision, echoic memory for audition). Information attended to enters Working Memory (WM), famously conceptualized by Alan Baddeley. Working memory consists of:
- The Central Executive: Coordinates attentional focus, supervisory control, and task switching.
- The Phonological Loop: Manages acoustic and verbal information through subvocal rehearsal.
- The Visuospatial Sketchpad: Manipulates visual imagery and spatial coordinates.
- The Episodic Buffer: Integrates multi-modal information into coherent chronological episodes with long-term memory links.
Electrophysiological recordings in non-human primates show that persistent neural firing in the dorsolateral prefrontal cortex (dlPFC) sustains representations during delay periods in working memory tasks.

1.2 Long-Term Memory Taxonomies
Long-term memory divides into Declarative (Explicit) and Non-Declarative (Implicit) memory.
- Declarative Memory: Conscious recollection of facts and events. It sub-divides into Episodic memory (autobiographical events localized in time and place) and Semantic memory (general world knowledge, vocabulary, and facts stripped of context).
- Non-Declarative Memory: Procedural memory (motor skills like cycling or mirror-tracing, mediated by basal ganglia and cerebellum), Classical conditioning (cerebellar circuits and amygdala for fear conditioning), and Priming (neocortical perceptual representations).

CHAPTER 2: SYNAPTIC PLASTICITY AND CELLULAR MECHANISMS
The cellular foundation of learning rests upon Donald Hebb's postulate (1949): "When an axon of cell A is near enough to excite cell B and repeatedly or persistently takes part in firing it, some growth process or metabolic change takes place."

2.1 Long-Term Potentiation (LTP)
Discovered by Terje Lømo and Timothy Bliss in the rabbit hippocampus (1973), Long-Term Potentiation is a persistent increase in synaptic strength following high-frequency stimulation.
The primary molecular coincidence detector for associative LTP is the NMDA (N-methyl-D-aspartate) glutamate receptor.
- Under resting membrane potentials (-70 mV), the NMDA receptor pore is blocked by an extracellular magnesium ion (Mg2+).
- When the postsynaptic dendritic spine undergoes strong depolarization (via AMPA receptor activation), the positive intracellular charge repels and ejects the Mg2+ ion.
- If glutamate is simultaneously bound to NMDA, calcium ions (Ca2+) flood into the dendritic spine.
- The calcium influx activates Calcium/Calmodulin-Dependent Protein Kinase II (CaMKII) and Protein Kinase C (PKC).
- CaMKII undergoes autophosphorylation and recruits additional AMPA receptors (GluA1 subunits) into the postsynaptic density (PSD), increasing postsynaptic sensitivity to future glutamate release.

2.2 Late-Phase LTP and Memory Consolidation
Early-phase LTP (E-LTP) decays within hours and does not require new protein synthesis. In contrast, Late-phase LTP (L-LTP) lasts days, weeks, or months and requires transcription and de novo translation.
Signaling cascades involving Adenylyl Cyclase, cyclic AMP (cAMP), and Protein Kinase A (PKA) translocate to the cell nucleus, phosphorylating the transcription factor CREB (cAMP response element-binding protein). Activated CREB initiates transcription of immediate early genes (c-Fos, Arc, Egr1) and structural proteins that enlarge dendritic spine heads and forge permanent synaptic connections.

CHAPTER 3: SYSTEM CONSOLIDATION AND HIPPOCAMPAL CIRCUITS
Information acquired in declarative memory relies acutely on the hippocampal formation: the dentate gyrus (DG), CA3, and CA1 subfields, along with the entorhinal and parahippocampal cortices.

3.1 The Trisynaptic Circuit
1. Perforant Path: Axons from layer II of the entorhinal cortex project to the granule cells of the Dentate Gyrus. The DG performs 'pattern separation', disambiguating overlapping inputs.
2. Mossy Fibers: Granule cell axons project to the CA3 pyramidal neurons. The CA3 possesses extensive recurrent collateral axons, enabling 'pattern completion'—retrieving complete memories from partial sensory cues.
3. Schaffer Collaterals: CA3 pyramidal neurons project to CA1 pyramidal cells, which subsequently project to the subiculum and back to the neocortex.

3.2 Standard Consolidation Theory vs. Multiple Trace Theory
The classic case of patient H.M. (Henry Molaison), who underwent bilateral medial temporal lobectomy in 1953, demonstrated profound anterograde amnesia with temporally graded retrograde amnesia (Ribot's law).
- Standard Consolidation Theory posits that the hippocampus acts as a temporary teaching module. Over time, sharp-wave ripples (SWRs) during slow-wave sleep reactivate hippocampal-neocortical networks, transferring permanent memory storage to distributed neocortical areas.
- Multiple Trace Theory (Nadel & Moscovitch) argues that the hippocampus is perpetually required for vivid, context-rich episodic memories, laying down new hippocampal traces each time a memory is recalled.`,
  },
  {
    title: 'Distributed Systems & Consensus Protocols',
    category: 'Computer Science & Software Architecture',
    fileName: 'Distributed_Systems_Consensus.txt',
    content: `SECTION 1: THE DISTRIBUTED SYSTEM ENVIRONMENT
A distributed system consists of autonomous computing nodes that communicate over an asynchronous, unreliable network while coordinating actions to appear as a coherent single system to end clients.

1.1 Failure Models & The Fallacies of Distributed Computing
Engineers must design for partial failure where nodes crash, recover, or experience arbitrary network partitions.
- Crash-Stop: Nodes function correctly until they halt; once halted, they never resume.
- Crash-Recovery: Nodes may halt unexpectedly and restart later with persistent disk state.
- Byzantine (Arbitrary) Faults: Nodes may act maliciously, send contradictory messages, or suffer memory corruption.
- Asynchronous Network: Messages may be delayed arbitrarily, duplicated, reordered, or lost entirely without upper bounds on transmission latency.

1.2 The CAP Theorem and PACELC
Formulated by Eric Brewer and proven by Seth Gilbert and Nancy Lynch, the CAP theorem states that a distributed data store can simultaneously provide at most two of the following three guarantees:
- Consistency (Linearizability): Every read receives the most recent write or an error.
- Availability: Every non-failing node returns a non-error response without guarantee it contains the most recent write.
- Partition Tolerance: The system continues to operate despite arbitrary message loss or network partitions.
Since physical networks inevitably experience partitions, systems must choose between Consistency (CP) and Availability (AP) during a partition. The PACELC theorem expands this: in the absence of partitions (Else), systems trade off Latency (L) versus Consistency (C).

SECTION 2: THE RAFT CONSENSUS PROTOCOL
Developed by Diego Ongaro and John Ousterhout at Stanford (2014), Raft was designed as an understandable alternative to Multi-Paxos for managing replicated state machines.

2.1 Server Roles and Term Epochs
At any moment, each Raft node is in one of three states:
- Leader: Handles all client requests, replicates log entries, and directs followers.
- Follower: Passive; responds to incoming RPCs from leaders and candidates.
- Candidate: Used during leader election when a follower times out without receiving heartbeats.
Time is divided into arbitrary terms numbered with sequential integers. Terms act as a logical clock, allowing servers to detect obsolete leaders and stale candidates.

2.2 Leader Election Mechanics
- Nodes begin as Followers with randomized election timeouts (typically between 150ms and 300ms) to prevent split-vote deadlocks.
- If a follower hears no heartbeat (AppendEntries RPC) before its timeout expires, it increments its currentTerm, transitions to Candidate, votes for itself, and broadcasts RequestVote RPCs.
- A candidate wins the election if it receives votes from a strict majority (N/2 + 1) of cluster nodes.
- Raft Election Safety: A follower will only grant its vote if the candidate's log is at least as up-to-date as its own (comparing last log term first, then last log index).

2.3 Log Replication and Safety Invariants
1. Client sends a command to the Leader.
2. The Leader appends the command to its local log as an uncommitted entry.
3. The Leader broadcasts AppendEntries RPCs containing the new entry to all followers.
4. When the entry is safely replicated on a majority of servers, the leader marks the entry as Committed, applies it to its local State Machine, and returns success to the client.
5. In subsequent heartbeats, the leader communicates the updated commitIndex, prompting followers to apply the entry to their respective state machines.
Log Matching Invariant: If two logs contain an entry with the same index and term, they are guaranteed to be identical up to that index.`,
  },
  {
    title: 'Principles of Macroeconomics & Monetary Policy',
    category: 'Economics & Public Policy',
    fileName: 'Macroeconomics_Monetary_Policy.txt',
    content: `MODULE 1: NATIONAL INCOME ACCOUNTING AND AGGREGATE DEMAND
Macroeconomics studies economy-wide phenomena including inflation, unemployment, gross domestic product (GDP), and business cycle fluctuations.

1.1 Gross Domestic Product (GDP) Measurement
Gross Domestic Product represents the total monetary value of all final goods and services produced within a country's geographic borders over a specific period.
The Expenditure Approach equation:
Y = C + I + G + (X - M)
Where:
- Y = Total GDP
- C = Household Consumption (typically 65-70% of US GDP)
- I = Gross Private Domestic Investment (business capital expenditures, residential construction, inventory changes)
- G = Government Purchases of goods and services (excluding transfer payments like Social Security)
- (X - M) = Net Exports (Exports minus Imports)
Real GDP adjusts nominal GDP using a GDP deflator or Consumer Price Index (CPI) to remove the distortive effects of price inflation, isolating true physical output expansion.

MODULE 2: INFLATION, EMPLOYMENT, AND THE PHILLIPS CURVE
2.1 Types of Inflation
- Demand-Pull Inflation: Occurs when aggregate demand exceeds the economy's productive capacity at full employment ("too much money chasing too few goods").
- Cost-Push Inflation: Caused by significant supply shocks that escalate production costs (e.g., sudden oil embargoes, supply chain bottlenecks), shifting aggregate supply upward.
- Core Inflation: Measures price increases while excluding volatile energy and food components to reflect underlying long-term trends.

2.2 The Natural Rate of Unemployment and the Phillips Curve
The original Phillips Curve observed an empirical inverse relationship between nominal wage inflation and unemployment.
Milton Friedman and Edmund Phelps augmented this model, proving that in the long run, there is no trade-off between inflation and unemployment. The Long-Run Phillips Curve (LRPC) is vertical at the Natural Rate of Unemployment (or NAIRU - Non-Accelerating Inflation Rate of Unemployment). Any attempt by central banks to artificially depress unemployment below NAIRU yields accelerating inflation expectations without permanent employment gains.

MODULE 3: CENTRAL BANKING AND MONETARY INSTRUMENTS
Central banks (e.g., the Federal Reserve, European Central Bank) manage the money supply and credit conditions to achieve macroeconomic stability (the dual mandate: price stability and maximum sustainable employment).

3.1 Conventional Monetary Policy Tools
1. The Policy Interest Rate (Federal Funds Rate): The target rate at which depository institutions trade balances held at the central bank overnight. Raising rates dampens borrowing and investment, slowing inflation; lowering rates stimulates economic activity.
2. Reserve Requirements: The mandatory percentage of customer deposits commercial banks must hold in reserve.
3. Open Market Operations (OMOs): Buying or selling sovereign bonds in secondary markets to regulate banking liquidity.

3.2 The Taylor Rule
Developed by John Taylor (1993), the Taylor Rule provides a normative guideline for setting nominal policy interest rates:
R = r* + pi + 0.5(pi - pi*) + 0.5(y - y*)
Where:
- R = target nominal interest rate
- r* = neutral real interest rate (equilibrium rate)
- pi = current inflation rate
- pi* = target inflation rate (typically 2.0%)
- (y - y*) = output gap (percentage deviation of real GDP from potential GDP)

3.3 Unconventional Policy: Quantitative Easing (QE)
When nominal short-term interest rates reach the Zero Lower Bound (ZLB), central banks engage in Quantitative Easing—large-scale asset purchases of long-term government bonds and mortgage-backed securities to depress long-term borrowing yields and stimulate lending.`,
  },
];
