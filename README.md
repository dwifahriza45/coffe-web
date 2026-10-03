# C.R.E.M.A

Coffee Revenue, Management & Analytics.

```bash
cp .env.example .env
npm install
npm run dev
```

Login terhubung ke `POST /auth/login` pada Coffee API.

## Docker Hub

Workflow `.github/workflows/docker-hub.yml` membangun dan mengunggah image saat
push ke `main`/`master`, push tag `v*`, atau dijalankan manual dari tab Actions.
Workflow menggunakan action resmi Docker: https://docs.docker.com/build/ci/github-actions/.

Di GitHub repository **Settings → Secrets and variables → Actions**, tambahkan:

- Secret `DOCKERHUB_USERNAME`: username Docker Hub.
- Secret `DOCKERHUB_TOKEN`: access token Docker Hub dengan izin Read & Write.
- Variable `DOCKERHUB_REPOSITORY` (opsional): nama repository image, default `coffe-web`.

Image diterbitkan sebagai `<username>/coffe-web` dengan tag branch, `sha-<commit>`,
dan tag versi bila push tag `v*`. Tag `latest` diperbarui dari default branch.
Pastikan repository Docker Hub tersedia dan akun/token punya akses push.

Image production memakai Nginx, mendukung React Router, dan meneruskan `/api/`
ke backend melalui `API_UPSTREAM`. `VITE_API_URL` hanya dipakai proxy development.

```bash
docker build -t coffe-web .
docker run --rm -p 8080:80 \
  -e API_UPSTREAM=http://coffee-api:8081 \
  --network coffee-network \
  coffe-web
```

Sesuaikan `API_UPSTREAM` dengan alamat backend yang dapat dijangkau container.
Contoh di atas mengasumsikan backend bernama `coffee-api` sudah berjalan pada
network Docker `coffee-network`. Buka frontend di `http://localhost:8080`.

## Docker Compose

Isi `.env` dengan repository Docker Hub tanpa tag dan versi yang akan dijalankan:

```dotenv
DOCKER_IMAGE=your-dockerhub-username/coffe-web
IMAGE_TAG=sha-a1b2c3d
WEB_PORT=8085
API_UPSTREAM=http://coffee-api:8081
```

Gunakan tag SHA yang benar dari GitHub Actions/Docker Hub. Untuk image private,
jalankan `docker login` terlebih dahulu. Dari direktori `coffe-web`:

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
```

Frontend tersedia di `http://127.0.0.1:8085` pada host deployment.
Untuk update atau rollback, ubah `IMAGE_TAG`, lalu ulangi `pull` dan `up -d`.
`API_UPSTREAM` harus dapat dijangkau container frontend. Jika menggunakan nama
`coffee-api`, hubungkan container backend ke network `appnet` milik project
Compose ini, atau gunakan alamat backend yang dapat dijangkau melalui network.
