# Patram-FS talk: speaker notes

Generated from the deck. Keys: → next · ← back · F fullscreen · O overview · P presenter window · K skip optional slides · T clock · B blackout.

| # | Slide | min | cumulative (core path) |
|---|---|---|---|
| 1 | Patram-FS | 0.3 | 0.3 |
| 2 | Patram learns from document images and text | 1.2 | 1.5 |
| 3 | What we will talk about today | 0.7 | 2.2 |
| 4 | Part 1 · The problem | 0.2 | 2.4 |
| 5 | The simplest design is one file per sample | 1 | 3.4 |
| 6 | One machine and the stores it reads from | 1.5 | 4.9 |
| 7 | At ten million files, three things go wrong | 2 | 6.9 |
| 8 | Part 2 · Shards | 0.2 | 7.1 |
| 9 | Packing samples into a few large shards | 1.2 | 8.3 |
| 10 | Compressing the shards | 1 | 9.3 |
| 11 | Every sample has a fixed byte address | 1.2 | 10.5 |
| 12 | Only the read call changes | 0.8 | 11.3 |
| 13 | Part 3 · The daemon | 0.2 | 11.5 |
| 14 | Each machine caches shards on its local disk | 1.2 | 12.7 |
| 15 | One small daemon runs on each machine | 1 | 13.7 |
| 16 | Identical requests become one download | 1.8 | 15.5 |
| 17 | Where shard bytes travel on one machine | 1.2 | 16.7 |
| 18 | Part 4 · Reads and memory | 0.2 | 16.9 |
| 19 | The daemon is asked only on a missing shard | 1.2 | 18.1 |
| 20 | A read is one pread, with nothing in between | 1 | 19.1 |
| 21 | The two obvious ways to serve annotations | 1.3 | 20.4 |
| 22 | Warming keeps one shared copy in memory | 1.3 | 21.7 |
| 23 | Warming records and warming images | 1.2 | 22.9 |
| 24 | Part 5 · In production | 0.2 | 23.1 |
| 25 | Least recently asked-for shards are removed | 1.2 | 24.3 |
| 26 | Deleting a shard that is being read | 1 | 25.3 |
| 27 | A daemon per machine is a general pattern | 1 | 26.3 |
| 28 | Using Patram-FS takes three pieces | 0.7 | 27.0 |
| 29 | Existing tools against five requirements | 1.5 | 28.5 |
| 30 | Training Patram 1.5 from local disks | 0.8 | 29.3 |
| 31 | Where it fits, and the trade-offs we chose | 1 | 30.3 |
| 32 | Key takeaways | 1 | 31.3 |


**Core path ≈ 31.3 min.**

## 1. Patram-FS
*Introduction · ~0.3 min · no steps*

Hello everyone, and thank you for having us. This talk is about Patram-FS, the storage layer we built at BharatGen to feed training data to our GPUs. You do not need a storage background to follow it. We will start with what we do and why this problem comes up at all, and then build the design one decision at a time.

## 2. Patram learns from document images and text
*Introduction · ~1.2 min · no steps*

A few words on what we do. We are BharatGen, and on the vision team we train Patram, a family of vision-language models that read documents. Patram 1.5 learns from document images and the text that goes with them. So one training sample is two things: an image of a page, and an annotation that says what is on it, such as a transcription, or a question about the page and its answer.

Both are small. The image is 50 to 500 kilobytes. The annotation is a JSON record of about 300 bytes. But a training dataset holds tens of millions of them, and a training run reads them many times over.

On the right is where that reading happens. Each square is one GPU: 30 machines with 8 GPUs each, 240 GPUs. Every GPU is fed by several reader processes. Why does this matter? Because the GPU only does useful work when the data has arrived. If reading is slow, training waits, and that is the problem this talk is about.

## 3. What we will talk about today
*Introduction · ~0.7 min · no steps*

Here is the plan for the next half hour. There are five parts.

First the problem: why the simplest design, one file per sample, stops working at ten million files. Then shards, which is how we pack samples together while keeping each one individually readable. Then the daemon, a small program on each machine that makes sure a shard is downloaded only once. Then reads and memory: how a read stays as cheap as reading a local file, and how a hundred processes can share one copy of a file in memory. And finally how it runs in production: keeping the disk from filling up, why we did not use an existing tool, how Patram 1.5 was trained on it, and what we gave up.

On the right is the picture we will end up with. It will not mean much yet, and that is fine: we will build it one box at a time. Please interrupt at any time. Four slides will stop and ask you for an answer, so stay ready. Let us begin.

## 4. Part 1 · The problem
*1 · The problem · ~0.2 min · no steps*

Let us start with the design anyone would write first, and see where it breaks.

## 5. The simplest design is one file per sample
*1 · The problem · ~1 min · no steps*

The simplest way to store this data is one file per sample, and the simplest way to train on it is to open each file when you need it. Here is that code: for each path, load the image, load the JSON, and take a training step. There is nothing wrong with it, and it works very well for a thousand files.

Now look at the right. This is one machine. It has 8 GPUs, every GPU is fed by several reader processes, and all of them are opening different small files as fast as they can. Multiply that by 30 machines. Nothing coordinates those readers with each other. Each one simply opens the next file on its list.

Before we see what goes wrong at ten million files, we need a few terms for where those files can live.

## 6. One machine and the stores it reads from
*1 · The problem · ~1.5 min · no steps*

Five terms will come up for the rest of the talk, and they are all in this picture.

A machine is one server in the GPU cluster; people also call it a node. Ours each have 8 H100 GPUs, and there are 30 of them. A worker is a Python process that reads training samples, for example a data loader worker. A machine runs dozens of them, and nothing coordinates them with each other.

Each machine has a 30 terabyte NVMe drive attached directly to it. Reads from it take tens of microseconds.

Then there are two things outside the machine, so reaching them means crossing the network, which costs milliseconds. The shared filesystem is a network filesystem that every machine mounts, so every machine sees the same files. It keeps a metadata entry, called an inode, for every file. The object store is where datasets live long term; we use Amazon S3. Data is read and written as whole objects over the network, and it charges and limits by request.

Keep those two numbers in mind: tens of microseconds on this side, milliseconds on that side. A lot of this design follows from that gap.

## 7. At ten million files, three things go wrong
*1 · The problem · ~2 min · reveal steps: 2*

At ten million files, three things go wrong, and they are three different problems.

First, the shared filesystem. It keeps a metadata entry for every file, and it slows down with the number of files, whatever their size. At ten million files, just listing the dataset folder takes minutes. Worse, this is shared: the metadata load slows every other machine and every other team on the cluster.

**[step 1]** So move the data to the object store. It has plenty of room, but it limits requests, not bytes. S3 allows roughly 5,500 requests per second for each prefix. A run that fetches samples one at a time makes about ten million requests against that limit. Small files are the worst case, because you pay for one request per file however few bytes it holds.

**[step 2]** The third one is easy to miss. A machine runs several processes that read the same data: training, a data job, someone's notebook. They know nothing about each other, so each one fetches its own copy. That wastes the network, the disk and the memory.

Patram-FS solves these in order. Too many files is the first one, and that takes us to shards.

## 8. Part 2 · Shards
*2 · Shards · ~0.2 min · no steps*

The standard fix for too many small files is fewer, larger files. The interesting question is how to pack them so that one sample can still be read on its own.

## 9. Packing samples into a few large shards
*2 · Shards · ~1.2 min · no steps*

A shard is simply a large archive file holding many samples. We pack images into TAR files of about 10 gibibytes each, and annotations into JSONL files of about 1 gibibyte each. JSONL is one JSON record per line.

Watch the small files move into the bars. A dataset of tens of millions of samples becomes about two hundred shards.

Now read the table. Files in storage go from about ten million to about two hundred, so the shared filesystem has almost nothing to keep track of. Requests to the object store go from about ten million to about two hundred, because we fetch a whole shard in one request. And listing the folder goes from minutes to milliseconds. That is the first problem, and most of the second, solved by one idea.

But we have created a new problem. Training wants one image, and that image is now somewhere inside a 10 gibibyte file. How we pack it decides how expensive that is. Which brings us to a question for you.

## 10. Compressing the shards
*2 · Shards · ~1 min · reveal steps: 2*

Here is the situation. We have a 10 gibibyte image shard. The images inside are JPEGs, so they are already compressed. And a reader wants one image at a time, out of tens of thousands in the shard.

**[step 1]** So here is the question. Should we compress the shard file? Option A: compress the whole shard, as you normally would with an archive. Option B: store it uncompressed. Take a moment, and tell me which you would pick and why.

**[step 2]** We chose B, for two reasons. First, compression barely helps: the images are already JPEGs, and compressing them again saves 0 to 2 percent. Second, and this is the important one, in an uncompressed TAR file every image sits at a fixed byte position. So reading one image is one seek and one read, with nothing to unpack. And as a bonus, building a shard is plain copying, at 1 to 2 gigabytes per second. That fixed position is the idea the rest of the design rests on.

## 11. Every sample has a fixed byte address
*2 · Shards · ~1.2 min · no steps*

So every sample has an address: the shard it lives in, the byte where it starts, and its length. Watch the selection move along this shard. Each sample has its own offset and length, and because nothing is compressed, those numbers point at the exact bytes.

We write that address as a short link, which you see at the bottom: patram, colon, slash slash, image id, then the shard, offset and length. It contains everything needed to read the sample. No index has to be loaded and no service has to be asked. So an address can go anywhere a file path used to go: a list of samples, a config file, a column in a table.

That last point turns out to matter a lot, as the next slide shows.

## 12. Only the read call changes
*2 · Shards · ~0.8 min · no steps*

Here is why the address matters. Our data pipelines, training loops and evaluation scripts were all written for one assumption: each sample is a file at a path. If you give each sample an address instead of a path, that code keeps its assumption. Only the read call changes.

At the top is the old code. At the bottom is the new code. These two functions, read_image and read_annotation, are the whole client interface, because an image plus a JSON record is the shape of all our training data. The library also has build_uri and parse_uri for making and checking addresses when you build a dataset.

The promise behind those two calls is simple: you read an address as if the shard were already a file on the machine's local drive. Of course it is not there yet. Making that promise true is the job of the next part.

## 13. Part 3 · The daemon
*3 · The daemon · ~0.2 min · no steps*

Shards fixed the file count. But fetching from the object store on every read would bring the request problem straight back. So each machine keeps the shards it uses on its own disk, and that creates the next problem.

## 14. Each machine caches shards on its local disk
*3 · The daemon · ~1.2 min · no steps*

Every machine in our cluster has a 30 terabyte NVMe drive attached directly to it. So the first time a machine needs a shard, it downloads the whole shard from the object store onto that drive. From then on, every sample in that shard is a local read.

Watch the two counters. Downloads tick up slowly, one per shard, and then stop. Reads keep climbing, and they are all coming from the local disk. A few big requests, then millions of small local reads. Compare that with the ten million requests we started from.

One detail: a download is written to a temporary file and renamed into place only when it is complete. A rename is a single step, so a reader never sees a half-downloaded shard.

This creates the next problem. A machine does not run one process. It runs eight training processes, one per GPU, each with several readers, and often a data job or a notebook beside them. They start at the same moment, they read the same shards, and they know nothing about each other. If each one downloads a shard whenever it finds it missing, the machine downloads the same 10 gibibyte shard many times over.

## 15. One small daemon runs on each machine
*3 · The daemon · ~1 min · no steps*

The fix is one small program on each machine. We call it the Patram-FS daemon. It is a background program written in Go that runs all the time. Every process on the machine, whether training, a data job or a notebook, talks to that same daemon.

They talk through a Unix domain socket. That is a channel between processes on one machine that goes only through the kernel, with no network in the way. It is quick: from Python, a round trip takes a median of 74 microseconds, and 20 processes together pushed 124,000 requests per second through it.

The main request is called ensure_shard. A process sends it when a shard it needs is not on the local disk. The daemon checks the disk, and starts a download only if the shard is not there and is not already downloading. It answers one question: is this shard on the local disk, and where?

Why a socket and not shared memory, which is about fifty times faster? Because the daemon is asked once per shard, not once per sample, so a few microseconds is nothing. And the kernel cleans up after a crashed client, which is worth more to us. If anyone wants more detail on that, or on why Go, ask at the end.

## 16. Identical requests become one download
*3 · The daemon · ~1.8 min · reveal steps: 1*

Here is the same moment, played twice: eight processes need the same shard at the same instant. On the left there is no daemon, and each process finds the shard missing and downloads it for itself. That is 8 downloads and 80 gibibytes pulled from the object store. This is not hypothetical: an earlier design of ours did exactly that, and 16 reader processes missing the same shard caused 16 separate downloads.

On the right is the same moment with the daemon. All eight processes send their request to it. The daemon sees eight requests for the same shard and merges them into one download. Any process that asks while the download is running simply waits for that same download, and they all continue together when it finishes. One download, 10 gibibytes, one copy on the disk, shared by all eight.

**[step 1]** And here is the measurement. We had 20 processes ask for the same missing 1 gibibyte shard at the same instant. The daemon made one download, and all 20 processes had the shard in 2.16 seconds, the time a single process takes on its own. Asking for a shard that is already on the disk takes under 100 microseconds.

## 17. Where shard bytes travel on one machine
*3 · The daemon · ~1.2 min · reveal steps: 2*

Here are the pieces on one machine so far. Three processes, the socket, the daemon, the local drive, and the object store outside. The dashed lines are questions: ensure_shard, once per shard. The orange line is the download. I have left something out on purpose: how do the bytes get from the drive to the process?

**[step 1]** Every process already talks to the daemon, so the tempting design is to route everything through it. The daemon reads the file and passes the bytes along, like a small server. The other option is that the daemon only says where the file is, and the process reads it directly. Which would you choose? Remember the ratio: millions of reads, and one question per shard.

**[step 2]** We chose B, and the green line shows it. The daemon never handles the data. It answers "is this shard on the local disk, and where?", and the process reads the bytes on its own. Two things follow. The daemon cannot become a bandwidth bottleneck, because no data passes through it. And restarting it cannot break a read in progress, because each reader holds its own open file.

There is also a bonus to having one daemon per machine: every machine-wide question has one place to be answered. How hard are we hitting the object store, what is cached, how many bytes were downloaded today? Each daemon publishes those as Prometheus metrics, so the whole cluster reads as one Grafana dashboard.

## 18. Part 4 · Reads and memory
*4 · Reads and memory · ~0.2 min · no steps*

The daemon solved downloads. Now we look at the reads themselves, because that is where the run spends its time: first image reads, and then annotations, which turn out to need something extra.

## 19. The daemon is asked only on a missing shard
*4 · Reads and memory · ~1.2 min · no steps*

A process does not ask the daemon before every read. Because cached shards are named by a fixed rule, a process can work out by itself where a shard should be on the local disk. So it just tries: it opens that file, and reads the sample at its offset with pread, a single system call that reads a given number of bytes from a given position.

Only if the open fails with FileNotFoundError does it send ensure_shard to the daemon, and then it tries again.

Watch the two counters here. At the start the shard is not on this machine, so each of the four processes gets the error and asks. That is four questions. The daemon downloads the shard once, and every process retries. And from then on the question counter stays at four while reads keep climbing.

So for each shard, only the first processes to reach it ever talk to the daemon. Every later read, from every process, for the rest of the run, is an ordinary open and read of a local file.

## 20. A read is one pread, with nothing in between
*4 · Reads and memory · ~1 min · no steps*

So what does a read look like once a shard is on the disk? Follow the boxes. The process calls read_image. The shard file is usually already open, because each process keeps a few open, 16 of each kind by default, which skips even the open. Then one system call, pread, with an offset and a length. And then the drive.

There is nothing else on the path. An uncompressed TAR member needs no decoding of its own. So no unpacking, no decompression, no format conversion and no filesystem layer between the drive and your tensor.

How much does that matter? On the left: our first version of this system was a FUSE mount, which is the obvious way to build it, since it looks like an ordinary folder. Each image read cost 1 to 3 milliseconds, against 50 to 200 microseconds for a direct read from NVMe. FUSE pays that extra hop on every single read, and an epoch has tens of millions of reads.

On the right: the only real wait left in the system is the first download of a shard. Because ensure_shard can be called for a shard you have not reached yet, a data loader can fetch the next shard while it is still training on the current one. So even that wait overlaps with useful work.

That covers images. Annotations are a different story.

## 21. The two obvious ways to serve annotations
*4 · Reads and memory · ~1.3 min · reveal steps: 1*

An annotation shard is a 1 gibibyte JSONL file holding millions of small records of about 300 bytes each. During training, each worker needs a few records at a time, from scattered places in the file, and every worker on the machine does this at once. There are two obvious ways to give them their records.

The first: load the whole file into every worker. Here you see four workers each filling a row of memory with their own copy. Each row can hold one full copy of the file. Lookups are fast after that. But workers cannot share their memory with each other, so 100 workers hold 100 copies of the same file: 100 gibibytes of memory for 1 gibibyte of data, and every worker waits for the load before it can start.

**[step 1]** The second: keep the file on the drive and read only each record's bytes with pread, the way we read images. Memory stays small, as you can see. But every record is a separate trip to the drive, at a median of 297.6 microseconds for a 300-byte record. Training makes millions of these, all from the same drive, and they queue behind each other. The drive becomes the bottleneck.

What we want is the small reads of the second approach, answered from memory, with one copy of the file for the whole machine. It turns out Linux already has the piece that makes this possible.

## 22. Warming keeps one shared copy in memory
*4 · Reads and memory · ~1.3 min · no steps*

The piece is the page cache. Whenever a process reads part of a file, the Linux kernel keeps those bytes in spare memory. The next time any process on the machine reads the same bytes, the kernel answers from memory and does not touch the drive. There is one copy of each piece of the file, shared by every process.

On its own, the page cache fills too slowly here. A scattered read brings in only the small piece of the file around one record, so for a long time most reads still miss and go to the drive. That is what you saw on the last slide.

Warming fixes that. When an annotation shard is first fetched, the client sends the daemon a warm_shard request, and the daemon asks the kernel to load the whole file into the page cache in one call. That takes about half a second for 1 gibibyte. You can see one row of memory filling, once.

And from then on, the workers keep making exactly the same small pread calls, and every one is answered from memory. So we get the best of both. Like the first approach, every read comes from memory. Like the second, each worker reads only the record it needs and keeps no copy of its own, so the machine holds one copy, however many workers there are. And we did not write any sharing layer: the kernel already had one.

## 23. Warming records and warming images
*4 · Reads and memory · ~1.2 min · reveal steps: 2*

Here is what warming did for annotations. Reading one record from a 1 gibibyte JSONL file took a median of 297.6 microseconds before warming, and 26.7 microseconds after. That is 11 times faster per read. Over a full pass of random reads, with the half-second warm-up counted in, total time fell from 8.58 to 3.33 seconds. And with 8 workers reading at once, throughput rose from 19,846 to 28,060 reads per second, because the workers no longer queue on the drive.

**[step 1]** So you have a tool that made reads eleven times faster. You also have image shards. Should you warm those as well? Think about what an image read actually does before you answer.

**[step 2]** No. We measured it, and every warming setting landed within 1.5 percent of not warming at all: 509 seconds against 501. Reading an image takes about 15 milliseconds, and nearly all of that is spent decoding the JPEG, not waiting on the drive. Warming a 10 gibibyte shard also takes about 5 seconds. So the daemon uses opposite settings for the two kinds of shard: annotation shards are always warmed, and image shards never are. This is also why 10 gibibyte image shards are fine: they only need to sit on the drive, never in memory.

The lesson is the one to take away from this part. The same step gave very different results on two kinds of data, and only measuring told us which was which.

## 24. Part 5 · In production
*5 · In production · ~0.2 min · no steps*

The design is complete. Now the practical questions: the disk fills up, so what then? How do you use this? Why not use an existing tool? And did it work for a real training run?

## 25. Least recently asked-for shards are removed
*5 · In production · ~1.2 min · no steps*

A machine's disk holds whichever shards its jobs are using, and eventually it fills up. Each kind of shard has its own space budget on the disk, with an upper mark and a lower mark. When a download pushes a budget over its upper mark, the daemon deletes the shards that were asked for least recently, until usage is back under the lower mark.

Follow the bar. Shards are ordered from least recently asked for on the left to most recently on the right. Shards 7 and 8 arrive, and the budget reaches the upper mark. Shard 2 is asked for again, so it moves to the newest end. Shard 9 pushes it over. The oldest shards go, down to the lower mark. Going down to the lower mark, and not just under the upper one, leaves room for several more downloads before the next clean-up.

Three details make this safe. Separate budgets: one 1 gibibyte annotation shard holds the records for images spread across many 10 gibibyte image shards, so if they shared a budget, a run of image downloads could push out the small shard everyone needs. A grace period: a shard handed to a process in the last few seconds is never removed, even if that process has not opened it yet. And it runs in the background, so the request that triggered it does not wait.

There is one more case, and it is a good question for you.

## 26. Deleting a shard that is being read
*5 · In production · ~1 min · reveal steps: 2*

Here is a shard on the disk. A file on Linux is really two things: a name in a folder, and the data the name points to. Process A has this shard open and is in the middle of reading it. Now the budget goes over its mark, and this shard is the least recently asked for, so the daemon deletes it.

**[step 1]** What happens to process A? Does its next read fail? Does the daemon have to wait until it is done, which would mean tracking every reader? Or does it finish normally? Take a guess.

**[step 2]** It finishes normally, and the daemon does not have to track anyone. On Linux, deleting a file removes its name at once, but its data stays until the last process that has it open closes it. So a process in the middle of a shard carries on. A process that opens the shard afterwards finds it missing, gets FileNotFoundError, and asks the daemon again. That is simply the normal path for any missing shard. We did not need to build anything for this case: it is the same miss path you saw earlier.

## 27. A daemon per machine is a general pattern
*5 · In production · ~1 min · no steps*

Let us step back from shards. On a busy machine, many processes that know nothing about each other need the same shared things: files from the object store, rows from a database, space on the drive, memory. Left alone, each process fetches, queries and caches for itself, and every shared service sees dozens of separate clients from every machine. Making them coordinate directly would mean each one knowing about all the others.

A daemon on each machine avoids both. Each process asks its local daemon, and only the daemon talks to the shared service. Because every request on the machine passes through one place, the daemon can merge identical requests, batch the rest into one query, keep one cache, and limit how hard the machine hits the service. So the machine looks like one client.

Patram-FS uses this pattern three times. Requests for the same shard become one download. Record lookups from every process become one batched database query. And the drive and page cache hold one copy of each shard, under one budget.

It is also not tied to images. Nothing outside the daemon knows where shards come from: "the object store" means one download routine that calls rclone, an open-source tool that works with every major object store. And the daemon does not care what is in a shard. It can hold text, speech audio or video frames; a new reader function decides how to turn the bytes into a sample. What keeps it safe is the same rule as before: the daemon coordinates, and the data goes directly from the drive to the process.

## 28. Using Patram-FS takes three pieces
*5 · In production · ~0.7 min · no steps*

If you wanted to use this, there are three pieces. Build the shards: pack images into uncompressed TAR files, annotations into JSONL files, upload them to the object store, and record each sample's address, or put its shard, offset and length in a database table. Run the daemon on every machine: it runs as a container that restarts itself if it stops, and one command deploys it across the cluster and sizes each machine's cache budgets to its free drive space. Install the client library: the Python package has no required dependencies, and reading images also needs OpenCV and NumPy.

Most code only ever calls the two read functions. Underneath, the library talks to the daemon with three requests. You have seen ensure_shard and warm_shard. The third, db_lookup, is for reading by a short record id instead of a full address: it turns an id into a shard, offset and length, and the daemon gathers the requests that arrive together into one query, so the DB sees one client per machine instead of one per worker.

A rule we kept throughout: every request gets a reply, even when something fails. If the DB or the object store has a problem, the daemon answers with an error instead of leaving the caller waiting. To watch it in production, each daemon exports metrics for requests, downloads, bytes downloaded, evictions and cache usage, and alerts fire when a daemon stops responding or its requests start failing.

## 29. Existing tools against five requirements
*5 · In production · ~1.5 min · no steps*

A fair question at this point is: why build this at all? Serving shared training data from object storage to many processes on one machine is a narrow problem, and few tools aim at it. We found five that come close, and we read their documentation and source. Our workload needs five things at once, and those are the columns. One cache per machine, shared by every process. Reads at local-disk speed. Plain files, so nothing is converted. Little to run, because the machines are there to train. And every kind of job with a small code change, because training is not the only reader: data generation, annotation and analysis jobs and notebooks read the same data, mostly as plain Python that opens a file path.

Read it by row. StreamingDataset is an excellent library, but each dataset object has its own cache, data must be rewritten into its own format, and it is built around a training data loader. WebDataset is the closest to our format, but every process downloads for itself. Alluxio would have worked: its cost is masters, workers and a JVM. JuiceFS and Mountpoint for S3 show a bucket as a folder, and they pay a FUSE hop on every read.

I want to be fair here. None of these is a poor tool. They were built for other workloads. If one coordinated training job is your only workload, a streaming dataset library is an excellent default, and it gives you things Patram-FS does not, such as shard-aware sampling and exact resumption on a different number of GPUs. If you need one cache shared across machines, or a normal file path that unmodified programs can open, look at Alluxio or JuiceFS. We built this because no single tool met all five for us.

## 30. Training Patram 1.5 from local disks
*5 · In production · ~0.8 min · no steps*

Did it work? Before Patram-FS, training read its data from the cluster's shared filesystem. At the scale Patram 1.5 needed, that was too slow, too small and too expensive. Millions of small reads load a filesystem that every machine and team shares. There was not enough space for the training data at that scale. And growing it to that size was very expensive.

With Patram-FS, the shared filesystem is off the data path. We trained the 7B Patram 1.5 model on 41 billion tokens across 128 GPUs, with its training data in S3 and, once a machine needed a shard, on that machine's local NVMe drive.

Training is not the only reader. Our dataset-construction pipelines install the same library and read records by patram address, sharing each machine's cache with whatever training job is running there. That is the reason the design keeps a per-sample address: any code that used to take a path can take an address instead. The training corpus itself was generated by our data pipeline engine, Patram-Ingest, which is described separately.

## 31. Where it fits, and the trade-offs we chose
*5 · In production · ~1 min · no steps*

So where does this fit? It works well when many unrelated processes on one machine read the same data, when your code was written for "each sample has its own path", when you want reads at the speed of the local drive, and when you want to be free to change object store, behind one replaceable download routine.

And here is what we gave up on purpose. First, it is not a filesystem. You cannot list the dataset with ls, and code reads samples by address through two functions instead of opening paths.

Second, sampling needs some shard locality. This one is important. A sampler that jumps uniformly across every shard defeats the cache: each read can pull down another 10 gibibyte shard and push out one that is still in use. Reading in a shard-aware order keeps it cheap. The little animation shows the difference: a read head that stays within a shard, against one that jumps. Patram-FS does not enforce this for you, so the caller has to choose a sensible order.

Third, it is one more program to run. If a daemon stops, every process on that machine can still read every shard already on its disk, but no new shard arrives until the daemon is back. We accept that, and the daemon restarts itself and has alerts on it.

## 32. Key takeaways
*5 · In production · ~1 min · no steps*

Let me leave you with five ideas, because they apply well beyond this system.

Pack small samples into large uncompressed shards, and keep a byte address per sample. The address is what lets existing code keep working with a one-line change.

Put machine-wide coordination in one process, and keep it off the data path. A daemon that never carries data cannot slow reads down, and one daemon per machine turns de-duplication, rate limits and monitoring into local problems.

Ask only on a miss. Try the local file first. Once a shard is on the disk, a read is an ordinary local read.

Use the page cache as shared memory. Warm a file once and every process on the machine reads it from memory, one copy for all, with no sharing layer of your own.

And measure each kind of data before choosing defaults. The same warming step made annotation reads 11 times faster and made no difference for images.

That is Patram-FS. Thank you, and we are happy to take questions.

**Likely questions.** Why a Unix socket and not shared memory? Shared memory is about fifty times faster, but the daemon is asked once per shard, and the kernel handles framing and clean-up after a crashed client. Why Go and not Python or Rust? Python would put downloads, socket handling and kernel calls on one core because of the global interpreter lock, and Rust costs more time to write and maintain, for garbage-collection pauses that are invisible next to a download. The daemon is about 2,500 lines of Go. How are cached shards named? With percent-encoding of the object's location, which is reversible, so two locations can never collide; a hash could silently serve the wrong images. How do lookups batch without a timer? The daemon keeps up to 8 queries in flight, so a lone request goes out at once in about 1 millisecond, and requests arriving while all slots are busy go out together when one frees: 128 lookups resolve in two or three DB round trips.
