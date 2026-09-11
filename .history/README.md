# Git history

The release ZIP includes `repository.bundle`, generated from the clean, tagged release HEAD.
It contains the imported v0.1.0 baseline and separate fix/test/documentation commits.
The bundle is a release artifact, not a tracked file (avoids embedding history into itself).

To restore a working Git repository, from the extracted project root:

```bash
git clone .history/repository.bundle ../meshtailor-js-with-history
cd ../meshtailor-js-with-history
git log --oneline --all
```

No private keys, remote credentials, dependencies or developer machine paths are included.
