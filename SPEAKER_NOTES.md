# Patram-FS talk: speaker notes

Generated from the deck. Keys: → next · ← back · F fullscreen · O overview · P presenter window · K skip optional slides · T clock · B blackout.

| # | Slide | min | cumulative (core path) |
|---|---|---|---|
| 1 | Patram-FS | 0.3 | 0.3 |
| 2 | We train Patram, a model that reads documents | 1.5 | 1.8 |
| 3 | What we will talk about today | 0.7 | 2.5 |
| 4 | Part 1 · The problem | 0.2 | 2.7 |
| 5 | A GPU can only learn when data has arrived | 1.5 | 4.2 |
| 6 | A dataset is tens of millions of small files | 1 | 5.2 |
| 7 | Many readers ask for files at the same moment | 1 | 6.2 |
| 8 | The files can live in three places | 1.5 | 7.7 |
| 9 | More files means a slower shared filesystem | 1.8 | 9.5 |
| 10 | The object store limits requests, not bytes | 1.8 | 11.3 |
| 11 | Each process fetches the same data again | 1 | 12.3 |
| 12 | Three problems, and what each one needs | 0.8 | 13.1 |
| 13 | Cutting ten million requests | 1 | 14.1 |
| 14 | Part 2 · Pack the files | 0.3 | 14.4 |
| 15 | A shard is one large file holding many samples | 1.2 | 15.6 |
| 16 | Compressing the shards | 1 | 16.6 |
| 17 | Every sample has a fixed byte address | 1.2 | 17.8 |
| 18 | Only the read call changes | 0.8 | 18.6 |
| 19 | Part 3 · Keep them local | 0.3 | 18.9 |
| 20 | Download each shard once, then read it locally | 1.2 | 20.1 |
| 21 | One small daemon on each machine fetches shards | 1 | 21.1 |
| 22 | Identical requests become one download | 1.8 | 22.9 |
| 23 | Where shard bytes travel on one machine | 1.2 | 24.1 |
| 24 | Part 4 · Read them fast | 0.3 | 24.4 |
| 25 | The daemon is asked only when a shard is missing | 1.2 | 25.6 |
| 26 | A read goes straight to the drive | 1 | 26.6 |
| 27 | For annotations, both obvious ways fail | 1.3 | 27.9 |
| 28 | Warming keeps one shared copy in memory | 1.3 | 29.2 |
| 29 | Warming records and warming images | 1.2 | 30.4 |
| 30 | Part 5 · Run it | 0.3 | 30.7 |
| 31 | Least recently asked-for shards are removed | 1.2 | 31.9 |
| 32 | Deleting a shard that is being read | 1 | 32.9 |
| 33 | The whole design, in one read | 1.2 | 34.1 |
| 34 | A daemon per machine is a general pattern | 1 | 35.1 |
| 35 | Existing tools against five requirements | 1.5 | 36.6 |
| 36 | Training Patram 1.5 from local disks | 0.8 | 37.4 |
| 37 | Where it fits, and the trade-offs we chose | 1 | 38.4 |
| 38 | Key takeaways | 1 | 39.4 |


**Core path ≈ 39.4 min.**

## 1. Patram-FS
*Introduction · ~0.3 min · no steps*

Hello everyone, and thank you for having us. This talk is about Patram-FS, the storage layer we built at BharatGen to feed training data to our GPUs. You do not need a storage background to follow it. We will start with what we do and why this problem comes up at all, and then build the design one decision at a time.

## 2. We train Patram, a model that reads documents
*Introduction · ~1.5 min · no steps*

A few words on what we do. We are BharatGen, and on the vision team we train Patram, a family of vision-language models that read documents.

Training data for a model like this is simple. One sample is two things: an image of a page, and an annotation that says what is on it, such as a transcription, or a question about the page and its answer.

Training itself is a loop. Show the model a sample. Compare its answer with the right one. Adjust the model a little. Take the next sample. That loop runs on GPUs, and every time it comes round it needs a new sample. Keep that in mind, because this whole talk is about getting that next sample to the GPU on time.

## 3. What we will talk about today
*Introduction · ~0.7 min · no steps*

Here is the plan for the next half hour. We will spend the most time on the first part, because the problem is unusual and the rest only makes sense once you have seen it. You do not need any storage background for this.

After that, each part fixes one problem and uncovers the next one. Pack the files, keep them on the machine, read them fast, and then what it takes to run this for real. A few slides will stop and ask you for an answer, so stay ready.

## 4. Part 1 · The problem
*1 · The problem · ~0.2 min · no steps*

Reading a file sounds like the easiest thing a computer does. So let us see how it becomes the problem, starting from a single GPU.

## 5. A GPU can only learn when data has arrived
*1 · The problem · ~1.5 min · no steps*

Here is one GPU. Think of it as a very expensive expert who reads pages and learns from them, and of the program feeding it as a helper who fetches each page from storage.

In the top row, the pages arrive on time. The GPU is green the whole way along: it finishes one sample and the next is already there.

In the bottom row, nothing about the GPU or the model has changed. The pages just take longer to arrive. Most of the bar is grey, which means the GPU is sitting idle, waiting. We are paying for a GPU that is doing nothing, and the run takes far longer.

So the job is to keep the GPU fed. That sounds easy for one GPU and one file. Let us look at how much there is to read.

## 6. A dataset is tens of millions of small files
*1 · The problem · ~1 min · no steps*

The obvious way to store this data is what you would do on your own laptop: one file for each image, and one file for each annotation, all in a folder.

Each one is small. An image is 50 to 500 kilobytes. An annotation is about 300 bytes, which is shorter than a text message.

But a training dataset holds tens of millions of them. Most computer systems are comfortable with a few very big files. They are much less comfortable with millions of tiny ones, and we will see exactly why in a moment. First, one more piece of the picture: who is reading them.

## 7. Many readers ask for files at the same moment
*1 · The problem · ~1 min · no steps*

Now the readers. A machine, one server in our cluster, has 8 GPUs. Each GPU is fed by several reader processes, which are the helpers from a moment ago. And there are 30 machines.

So at any moment, a very large number of processes are all opening different small files, as fast as they can, and none of them knows about the others.

All of those requests have to land somewhere. So where can we keep the files?

## 8. The files can live in three places
*1 · The problem · ~1.5 min · reveal steps: 2*

There are three places these files can live, and it helps to picture an office building. Each machine is one office.

First, the local drive. Each machine has a 30 terabyte NVMe drive attached directly to it. It is the shelf in your own office: reads take tens of microseconds. The catch is that only that machine can see it.

**[step 1]** Second, the shared filesystem. Every machine mounts it and sees the same files. It is one records room for the whole building. Reaching it crosses the network, which costs milliseconds, and it keeps an entry for every single file.

**[step 2]** Third, the object store, which for us is Amazon S3. It holds everything, long term. It is a warehouse across town: also milliseconds away, and it charges and limits you by the number of requests.

Notice the gap in speed: microseconds on the machine, milliseconds across the network. So the local drive is fast but private, and the two shared places are slow. Let us try putting ten million files in each of the shared ones, and see what happens.

## 9. More files means a slower shared filesystem
*1 · The problem · ~1.8 min · reveal steps: 1*

Let us try the shared filesystem. Before it can give you a single byte of a file, a filesystem has to look that file up: its name, its size, and where its bytes are. That bookkeeping is called metadata, and the filesystem keeps one entry for every file. Picture a clerk in the records room who has to find the right card before handing over any file.

On the left is some data stored as one big file: one lookup, and then the bytes flow. On the right is the same data stored as many small files. Every one of them needs its own lookup. Watch the counter. The disks are not the slow part here. The clerk is.

**[step 1]** Now scale that to ten million files. The cost grows with the number of files, whatever their size. Just listing the dataset folder takes minutes. And the part people forget: this filesystem is shared. Our readers keep the clerk busy, so every other machine on the cluster slows down too.

## 10. The object store limits requests, not bytes
*1 · The problem · ~1.8 min · reveal steps: 1*

So move the files out to the object store, the warehouse. It has plenty of room. But it works differently: you fetch a whole object per request, and the warehouse gate counts trips. Amazon S3 allows roughly 5,500 requests per second for each prefix, where a prefix is roughly like a folder.

Watch the queue build at the gate. Each dot is one request for one small file. And here is the odd part, on the right: a request for 300 bytes counts exactly the same as a request for 10 gibibytes. The gate does not care what the truck carries. So tiny files are the worst possible case.

**[step 1]** Let us do the sum. One file per sample means about ten million requests. Ten million divided by 5,500 a second is about 30 minutes, just to fetch the data once, at the limit, for one prefix. That is our own arithmetic, to give you a feel for it. A training run reads the data many times, on top of all the network time. Fetching one small file at a time simply does not work.

## 11. Each process fetches the same data again
*1 · The problem · ~1 min · no steps*

The third problem is easy to miss. A machine does not run just one program. It runs training, and often a data job beside it, and someone's notebook. They read the same data, but they know nothing about each other.

So each one fetches its own copy. Three people from the same office, each driving to the warehouse for the same box, and each keeping their own copy of it. That wastes the network, the disk and the memory, and it makes the request problem worse.

## 12. Three problems, and what each one needs
*1 · The problem · ~0.8 min · no steps*

So here is the whole problem on one slide. The shared filesystem suffers because there are too many small files. The object store suffers because there are too many requests. And on each machine, every process fetches its own copy.

There are also two conditions. Reads have to stay as fast as the local drive, because of the GPU we started with. And we have a lot of existing code that assumes each sample is a file at a path, and we do not want to rewrite all of it.

If this slide makes sense, the rest of the talk will too. So this is a good moment for questions. Then we fix these one at a time.

## 13. Cutting ten million requests
*1 · The problem · ~1 min · reveal steps: 2*

Before we move on, try this one. There are ten million small files in the object store. Each takes one request. And one request can bring back 300 bytes or 10 gibibytes, for the same cost.

**[step 1]** How would you cut the number of requests? Option A: send them in parallel, as many at once as you can. Option B: pack the small files into large ones. Which would you pick?

**[step 2]** B. Parallel requests are still ten million requests against the same limit. If one trip can carry anything, the answer is to fill the truck. That is the next part.

## 14. Part 2 · Pack the files
*2 · Pack the files · ~0.3 min · no steps*

On the right is our list of problems, and we will come back to it at the start of each part. Packing the files takes on the first two together. The interesting question is how to pack them so that one sample can still be read on its own.

## 15. A shard is one large file holding many samples
*2 · Pack the files · ~1.2 min · no steps*

A shard is simply a large archive file holding many samples. We pack images into TAR files of about 10 gibibytes each, and annotations into JSONL files of about 1 gibibyte each. JSONL is one JSON record per line.

Watch the small files move into the bars. A dataset of tens of millions of samples becomes about two hundred shards.

Now read the table. Files in storage go from about ten million to about two hundred, so the shared filesystem has almost nothing to keep track of. Requests to the object store go from about ten million to about two hundred, because we fetch a whole shard in one request. And listing the folder goes from minutes to milliseconds. That is the first two problems on our list, solved by one idea. Think of a box of pages: one trip to the warehouse now brings a whole box.

But we have created a new problem. Training wants one image, and that image is now somewhere inside a 10 gibibyte file. How we pack it decides how expensive that is. Which brings us to a question for you.

## 16. Compressing the shards
*2 · Pack the files · ~1 min · reveal steps: 2*

Here is the situation. We have a 10 gibibyte image shard. The images inside are JPEGs, so they are already compressed. And a reader wants one image at a time, out of tens of thousands in the shard.

**[step 1]** So here is the question. Should we compress the shard file? Option A: compress the whole shard, as you normally would with an archive. Option B: store it uncompressed. Take a moment, and tell me which you would pick and why.

**[step 2]** We chose B, for two reasons. First, compression barely helps: the images are already JPEGs, and compressing them again saves 0 to 2 percent. Second, and this is the important one, in an uncompressed TAR file every image sits at a fixed byte position. So reading one image is one seek and one read, with nothing to unpack. And as a bonus, building a shard is plain copying, at 1 to 2 gigabytes per second. That fixed position is the idea the rest of the design rests on.

## 17. Every sample has a fixed byte address
*2 · Pack the files · ~1.2 min · no steps*

So every sample has an address: which box, where in the box, and how long. In other words, the shard it lives in, the byte where it starts, and its length. Watch the selection move along this shard. Each sample has its own offset and length, and because nothing is compressed, those numbers point at the exact bytes.

We write that address as a short link, which you see at the bottom: patram, colon, slash slash, image id, then the shard, offset and length. It contains everything needed to read the sample. No index has to be loaded and no service has to be asked. So an address can go anywhere a file path used to go: a list of samples, a config file, a column in a table.

That last point turns out to matter a lot, as the next slide shows.

## 18. Only the read call changes
*2 · Pack the files · ~0.8 min · no steps*

Here is why the address matters. Our data pipelines, training loops and evaluation scripts were all written for one assumption: each sample is a file at a path. If you give each sample an address instead of a path, that code keeps its assumption. Only the read call changes.

You do not need to read this code closely. At the top is the old way, at the bottom is the new way, and the shape is the same: these two functions are all most code ever calls.

The promise behind those two calls is simple: you read an address as if the shard were already a file on the machine's local drive. Of course it is not there yet. Making that promise true is the job of the next part.

## 19. Part 3 · Keep them local
*3 · Keep them local · ~0.3 min · no steps*

The first two are fixed: few files, few requests. But the shards are still far away in the object store, and fetching from there on every read would bring the request problem straight back. So each machine keeps the shards it uses on its own disk, and that creates the third problem on our list.

## 20. Download each shard once, then read it locally
*3 · Keep them local · ~1.2 min · no steps*

Every machine in our cluster has a 30 terabyte NVMe drive attached directly to it. So the first time a machine needs a shard, it downloads the whole shard from the object store onto that drive. From then on, every sample in that shard is a local read.

Watch the two counters. Downloads tick up slowly, one per shard, and then stop. Reads keep climbing, and they are all coming from the local disk. A few big requests, then millions of small local reads. Compare that with the ten million requests we started from.

One detail: a download is written to a temporary file and renamed into place only when it is complete. A rename is a single step, so a reader never sees a half-downloaded shard.

This creates the next problem. A machine does not run one process. It runs eight training processes, one per GPU, each with several readers, and often a data job or a notebook beside them. They start at the same moment, they read the same shards, and they know nothing about each other. If each one downloads a shard whenever it finds it missing, the machine downloads the same 10 gibibyte shard many times over.

## 21. One small daemon on each machine fetches shards
*3 · Keep them local · ~1 min · no steps*

The fix is one small program on each machine. We call it the Patram-FS daemon. A daemon is simply a background program that runs all the time. Think of an office manager: instead of everyone driving to the warehouse, you tell the manager which box you need.

Every process on the machine, whether training, a data job or a notebook, talks to that same daemon through a Unix domain socket, a channel between processes on one machine with no network in the way.

The main request is called ensure_shard, and the daemon answers one question: is this shard on the local disk, and where? If the shard is missing and nobody has started downloading it, the daemon downloads it. Otherwise it does not.

If anyone asks: from Python, a round trip through the socket takes a median of 74 microseconds, measured with 20 processes flooding it together. We chose a socket over faster shared memory because the daemon is asked once per shard, not once per sample, and the kernel cleans up after a crashed client. The daemon is written in Go.

## 22. Identical requests become one download
*3 · Keep them local · ~1.8 min · reveal steps: 1*

Here is the same moment, played twice: eight processes need the same shard at the same instant. On the left there is no daemon, and each process finds the shard missing and downloads it for itself. That is 8 downloads and 80 gibibytes pulled from the object store. This is not hypothetical: an earlier design of ours did exactly that, and 16 reader processes missing the same shard caused 16 separate downloads.

On the right is the same moment with the daemon. All eight processes send their request to it. The daemon sees eight requests for the same shard and merges them into one download. Any process that asks while the download is running simply waits for that same download, and they all continue together when it finishes. One download, 10 gibibytes, one copy on the disk, shared by all eight.

**[step 1]** And here is the measurement. We had 20 processes ask for the same missing 1 gibibyte shard at the same instant. The daemon made one download, and all 20 processes had the shard in 2.16 seconds, the time a single process takes on its own. Asking for a shard that is already on the disk takes under 100 microseconds.

## 23. Where shard bytes travel on one machine
*3 · Keep them local · ~1.2 min · reveal steps: 2*

Here are the pieces on one machine so far. Three processes, the socket, the daemon, the local drive, and the object store outside. The dashed lines are questions: ensure_shard, once per shard. The orange line is the download. I have left something out on purpose: how do the bytes get from the drive to the process?

**[step 1]** Every process already talks to the daemon, so the tempting design is to route everything through it. The daemon reads the file and passes the bytes along, like a small server. The other option is that the daemon only says where the file is, and the process reads it directly. Which would you choose? Remember the ratio: millions of reads, and one question per shard.

**[step 2]** We chose B, and the green line shows it. The daemon never handles the data. It answers "is this shard on the local disk, and where?", and the process reads the bytes on its own. Two things follow. The daemon cannot become a bandwidth bottleneck, because no data passes through it. And restarting it cannot break a read in progress, because each reader holds its own open file.

There is also a bonus to having one daemon per machine: every machine-wide question has one place to be answered. How hard are we hitting the object store, what is cached, how many bytes were downloaded today? Each daemon publishes those as Prometheus metrics, so the whole cluster reads as one Grafana dashboard.

## 24. Part 4 · Read them fast
*4 · Read them fast · ~0.3 min · no steps*

Downloads are solved. Now the reads themselves, because that is where a run spends its time: first images, and then annotations, which turn out to need something extra.

## 25. The daemon is asked only when a shard is missing
*4 · Read them fast · ~1.2 min · no steps*

A process does not ask the daemon before every read. Because cached shards are named by a fixed rule, a process can work out by itself where a shard should be on the local disk. So it just tries: it opens that file and reads the sample at its position. Think of checking your own shelf before bothering the manager.

Only if the open fails with FileNotFoundError does it send ensure_shard to the daemon, and then it tries again.

Watch the two counters here. At the start the shard is not on this machine, so each of the four processes gets the error and asks. That is four questions. The daemon downloads the shard once, and every process retries. And from then on the question counter stays at four while reads keep climbing.

So for each shard, only the first processes to reach it ever talk to the daemon. Every later read, from every process, for the rest of the run, is an ordinary open and read of a local file.

## 26. A read goes straight to the drive
*4 · Read them fast · ~1 min · no steps*

So what does a read look like once a shard is on the disk? The process asks for one sample. One system call, called pread, says: read this many bytes from this position. And the drive returns them. That is all.

There is nothing else on the way. No daemon, no unpacking, no decompression, no format conversion, no filesystem layer. This is why we kept the shards uncompressed.

How much does that matter? Our first version of this system added one layer on every read, a FUSE mount, which is the obvious way to build it because it looks like an ordinary folder. Each image read cost 1 to 3 milliseconds, against 50 to 200 microseconds for a direct read. A training pass has tens of millions of reads, so that layer is paid tens of millions of times.

The only real wait left is the first download of a shard, and a process can ask for the next shard early, while it is still training on the current one, so even that overlaps with useful work.

That covers images. Annotations are a different story.

## 27. For annotations, both obvious ways fail
*4 · Read them fast · ~1.3 min · reveal steps: 1*

Images are large and read one at a time. Annotations are the opposite. An annotation shard is a 1 gibibyte JSONL file holding millions of small records of about 300 bytes each. During training, each worker needs a few records at a time, from scattered places in the file, and every worker on the machine does this at once. There are two obvious ways to give them their records.

The first: load the whole file into every worker. Here you see four workers each filling a row of memory with their own copy. Each row can hold one full copy of the file. Lookups are fast after that. But workers cannot share their memory with each other, so 100 workers hold 100 copies of the same file: 100 gibibytes of memory for 1 gibibyte of data, and every worker waits for the load before it can start.

**[step 1]** The second: keep the file on the drive and read only each record's bytes with pread, the way we read images. Memory stays small, as you can see. But every record is a separate trip to the drive, at a median of 297.6 microseconds for a 300-byte record. Training makes millions of these, all from the same drive, and they queue behind each other. The drive becomes the bottleneck.

What we want is the small reads of the second approach, answered from memory, with one copy of the file for the whole machine. It turns out Linux already has the piece that makes this possible.

## 28. Warming keeps one shared copy in memory
*4 · Read them fast · ~1.3 min · no steps*

The piece is the page cache. Whenever a process reads part of a file, the Linux kernel keeps those bytes in spare memory. The next time any process on the machine reads the same bytes, the kernel answers from memory and does not touch the drive. There is one copy of each piece of the file, shared by every process.

On its own, the page cache fills too slowly here. A scattered read brings in only the small piece of the file around one record, so for a long time most reads still miss and go to the drive. That is what you saw on the last slide.

Warming fixes that. When an annotation shard is first fetched, the client sends the daemon a warm_shard request, and the daemon asks the kernel to load the whole file into the page cache in one call, madvise with MADV_POPULATE_READ. That takes about half a second for 1 gibibyte. You can see one row of memory filling, once.

And from then on, the workers keep making exactly the same small pread calls, and every one is answered from memory. So we get the best of both. Like the first approach, every read comes from memory. Like the second, each worker reads only the record it needs and keeps no copy of its own, so the machine holds one copy, however many workers there are. And we did not write any sharing layer: the kernel already had one.

## 29. Warming records and warming images
*4 · Read them fast · ~1.2 min · reveal steps: 2*

Here is what warming did for annotations. Reading one record from a 1 gibibyte JSONL file took a median of 297.6 microseconds before warming, and 26.7 microseconds after. That is 11 times faster per read. Over a full pass of random reads, with the half-second warm-up counted in, total time fell from 8.58 to 3.33 seconds. And with 8 workers reading at once, throughput rose from 19,846 to 28,060 reads per second, because the workers no longer queue on the drive.

**[step 1]** So you have a tool that made reads eleven times faster. You also have image shards. Should you warm those as well? Think about what an image read actually does before you answer.

**[step 2]** No. We measured it, and every warming setting landed within 1.5 percent of not warming at all: 509 seconds against 501. Reading an image takes about 15 milliseconds, and nearly all of that is spent decoding the JPEG, not waiting on the drive. Warming a 10 gibibyte shard also takes about 5 seconds. So the daemon uses opposite settings for the two kinds of shard: annotation shards are always warmed, and image shards never are. This is also why 10 gibibyte image shards are fine: they only need to sit on the drive, never in memory.

The lesson is the one to take away from this part. The same step gave very different results on two kinds of data, and only measuring told us which was which.

## 30. Part 5 · Run it
*5 · Run it · ~0.3 min · no steps*

The design is nearly complete. One item is left on the list: the disk fills up. Then the practical questions: why not use an existing tool, did it work on a real run, and what did we give up?

## 31. Least recently asked-for shards are removed
*5 · Run it · ~1.2 min · no steps*

A machine's disk holds whichever shards its jobs are using, and eventually it fills up. Each kind of shard has its own space budget on the disk, with an upper mark and a lower mark. When a download pushes a budget over its upper mark, the daemon deletes the shards that were asked for least recently, until usage is back under the lower mark.

Follow the bar. Shards are ordered from least recently asked for on the left to most recently on the right. Shards 7 and 8 arrive, and the budget reaches the upper mark. Shard 2 is asked for again, so it moves to the newest end. Shard 9 pushes it over. The oldest shards go, down to the lower mark. Going down to the lower mark, and not just under the upper one, leaves room for several more downloads before the next clean-up.

Three details make this safe. Separate budgets: one 1 gibibyte annotation shard holds the records for images spread across many 10 gibibyte image shards, so if they shared a budget, a run of image downloads could push out the small shard everyone needs. A grace period: a shard handed to a process in the last few seconds is never removed, even if that process has not opened it yet. And it runs in the background, so the request that triggered it does not wait.

There is one more case, and it is a good question for you.

## 32. Deleting a shard that is being read
*5 · Run it · ~1 min · reveal steps: 2*

Here is a shard on the disk. A file on Linux is really two things: a name in a folder, and the data the name points to. Process A has this shard open and is in the middle of reading it. Now the budget goes over its mark, and this shard is the least recently asked for, so the daemon deletes it.

**[step 1]** What happens to process A? Does its next read fail? Does the daemon have to wait until it is done, which would mean tracking every reader? Or does it finish normally? Take a guess.

**[step 2]** It finishes normally, and the daemon does not have to track anyone. On Linux, deleting a file removes its name at once, but its data stays until the last process that has it open closes it. So a process in the middle of a shard carries on. A process that opens the shard afterwards finds it missing, gets FileNotFoundError, and asks the daemon again. That is simply the normal path for any missing shard. We did not need to build anything for this case: it is the same miss path you saw earlier.

## 33. The whole design, in one read
*5 · Run it · ~1.2 min · reveal steps: 3*

Before the practical questions, here is the whole design in one read, because you now know every piece.

A process starts with an address: the shard, the byte where the sample starts, and its length.

**[step 1]** It tries the local file. Every process can work out the name by a fixed rule, so it does not have to ask anyone.

**[step 2]** If the file is missing, it asks the daemon, shown as the dashed lines. The daemon downloads the shard once for the whole machine, the orange line, and warms it if it is an annotation shard.

**[step 3]** Then the process reads the bytes directly from the drive, the thick green line. And every later read, for the rest of the run, is only steps 2 and 4. The daemon is asked once per shard, and the green line runs millions of times.

## 34. A daemon per machine is a general pattern
*5 · Run it · ~1 min · no steps*

Let us step back from shards. On a busy machine, many processes that know nothing about each other need the same shared things: files from the object store, rows from a database, space on the drive, memory. Left alone, each process fetches, queries and caches for itself, and every shared service sees dozens of separate clients from every machine. Making them coordinate directly would mean each one knowing about all the others.

A daemon on each machine avoids both. Each process asks its local daemon, and only the daemon talks to the shared service. Because every request on the machine passes through one place, the daemon can merge identical requests, batch the rest into one query, keep one cache, and limit how hard the machine hits the service. So the machine looks like one client.

Patram-FS uses this pattern three times. Requests for the same shard become one download. Record lookups from every process become one batched database query. And the drive and page cache hold one copy of each shard, under one budget.

It is also not tied to images. Nothing outside the daemon knows where shards come from: "the object store" means one download routine that calls rclone, an open-source tool that works with every major object store. And the daemon does not care what is in a shard. It can hold text, speech audio or video frames; a new reader function decides how to turn the bytes into a sample. What keeps it safe is the same rule as before: the daemon coordinates, and the data goes directly from the drive to the process.

## 35. Existing tools against five requirements
*5 · Run it · ~1.5 min · no steps*

A fair question at this point is: why build this at all? Serving shared training data from object storage to many processes on one machine is a narrow problem, and few tools aim at it. We found five that come close, and we read their documentation and source. Our workload needs five things at once, and those are the columns. One cache per machine, shared by every process. Reads at local-disk speed. Plain files, so nothing is converted. Little to run, because the machines are there to train. And every kind of job with a small code change, because training is not the only reader: data generation, annotation and analysis jobs and notebooks read the same data, mostly as plain Python that opens a file path.

Read it by row. StreamingDataset is an excellent library, but each dataset object has its own cache, data must be rewritten into its own format, and it is built around a training data loader. WebDataset is the closest to our format, but every process downloads for itself. Alluxio would have worked: its cost is masters, workers and a JVM. JuiceFS and Mountpoint for S3 show a bucket as a folder, and they pay a FUSE hop on every read.

I want to be fair here. None of these is a poor tool. They were built for other workloads. If one coordinated training job is your only workload, a streaming dataset library is an excellent default, and it gives you things Patram-FS does not, such as shard-aware sampling and exact resumption on a different number of GPUs. If you need one cache shared across machines, or a normal file path that unmodified programs can open, look at Alluxio or JuiceFS. We built this because no single tool met all five for us.

## 36. Training Patram 1.5 from local disks
*5 · Run it · ~0.8 min · no steps*

Did it work? Before Patram-FS, training read its data from the cluster's shared filesystem. At the scale Patram 1.5 needed, that was too slow, too small and too expensive. Millions of small reads load a filesystem that every machine and team shares. There was not enough space for the training data at that scale. And growing it to that size was very expensive.

With Patram-FS, the shared filesystem is off the data path. We trained the 7B Patram 1.5 model on 41 billion tokens across 128 GPUs, with its training data in S3 and, once a machine needed a shard, on that machine's local NVMe drive.

Training is not the only reader. Our dataset-construction pipelines install the same library and read records by patram address, sharing each machine's cache with whatever training job is running there. That is the reason the design keeps a per-sample address: any code that used to take a path can take an address instead. The training corpus itself was generated by our data pipeline engine, Patram-Ingest, which is described separately.

## 37. Where it fits, and the trade-offs we chose
*5 · Run it · ~1 min · no steps*

So where does this fit? It works well when many unrelated processes on one machine read the same data, when your code was written for "each sample has its own path", when you want reads at the speed of the local drive, and when you want to be free to change object store, behind one replaceable download routine.

And here is what we gave up on purpose. First, it is not a filesystem. You cannot list the dataset with ls, and code reads samples by address through two functions instead of opening paths.

Second, sampling needs some shard locality. This one is important. A sampler that jumps uniformly across every shard defeats the cache: each read can pull down another 10 gibibyte shard and push out one that is still in use. Reading in a shard-aware order keeps it cheap. The little animation shows the difference: a read head that stays within a shard, against one that jumps. Patram-FS does not enforce this for you, so the caller has to choose a sensible order.

Third, it is one more program to run. If a daemon stops, every process on that machine can still read every shard already on its disk, but no new shard arrives until the daemon is back. We accept that, and the daemon restarts itself and has alerts on it.

## 38. Key takeaways
*5 · Run it · ~1 min · no steps*

Let me leave you with five ideas, because they apply well beyond this system.

Pack small samples into large uncompressed shards, and keep a byte address per sample. The address is what lets existing code keep working with a one-line change.

Put machine-wide coordination in one process, and keep it off the data path. A daemon that never carries data cannot slow reads down, and one daemon per machine turns de-duplication, rate limits and monitoring into local problems.

Ask only on a miss. Try the local file first. Once a shard is on the disk, a read is an ordinary local read.

Use the page cache as shared memory. Warm a file once and every process on the machine reads it from memory, one copy for all, with no sharing layer of your own.

And measure each kind of data before choosing defaults. The same warming step made annotation reads 11 times faster and made no difference for images.

That is Patram-FS. Thank you, and we are happy to take questions.

**Likely questions.** Why a Unix socket and not shared memory? Shared memory is about fifty times faster, but the daemon is asked once per shard, and the kernel handles framing and clean-up after a crashed client. Why Go and not Python or Rust? Python would put downloads, socket handling and kernel calls on one core because of the global interpreter lock, and Rust costs more time to write and maintain, for garbage-collection pauses that are invisible next to a download. The daemon is about 2,500 lines of Go. How are cached shards named? With percent-encoding of the object's location, which is reversible, so two locations can never collide; a hash could silently serve the wrong images. How do lookups batch without a timer? The daemon keeps up to 8 queries in flight, so a lone request goes out at once in about 1 millisecond, and requests arriving while all slots are busy go out together when one frees: 128 lookups resolve in two or three DB round trips.
