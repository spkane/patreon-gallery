# Screenshot example media

The posts, membership, attachment names and Patreon download URLs in the capture script are synthetic. No Patreon account or paid content is used.

## Earth photograph

`earth-apollo17.jpg` is a resized copy of **The Blue Marble**, photographed by the NASA/Apollo 17 crew in December 1972. The Wikimedia Commons source identifies it as public domain in the United States because it was solely created by NASA. Credit: **NASA / Apollo 17 crew**. NASA does not endorse Gallery Scout.

- Source and rights information: https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg
- Original image: https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg
- Checked: 2026-10-06.
- Modification: resized to 1200 × 1200 pixels and JPEG-compressed for this repository.

## Video

`earth-study.mp4` is a six-second silent pan/zoom animation created for these screenshots from the photograph above. It is not NASA footage or a recording of Patreon content. The video screenshot captures a decoded MP4 frame in the actual gallery `<video>` player.

Regenerate the video with FFmpeg (optional development tool):

```sh
ffmpeg -loop 1 -i docs/examples/earth-apollo17.jpg \
  -vf "scale=720:720,pad=1280:720:280:0:black,zoompan=z='1+0.0003*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1280x720:fps=24" \
  -t 6 -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p \
  -movflags +faststart docs/examples/earth-study.mp4
```

Run `scripts/capture-screenshots.cjs` as described in the repository README to refresh all four screenshots. All non-fixture network requests are blocked; none of this media is included in the extension release ZIP.
