.PHONY: setup deploy-nginx deploy-typescript clean-nginx clean-typescript

setup:
	sudo apt update
	sudo apt install -y snapd
	sudo snap install kubectl --classic

deploy-nginx:
	kubectl apply -f k8s/nginx/deployment.yaml
	kubectl apply -f k8s/nginx/service.yaml

deploy-typescript:
	kubectl apply -f k8s/typescript/deployment.yaml
	kubectl apply -f k8s/typescript/service.yaml

clean-nginx:
	kubectl delete -f k8s/nginx/service.yaml || true
	kubectl delete -f k8s/nginx/deployment.yaml || true

clean-typescript:
	kubectl delete -f k8s/typescript/service.yaml || true
	kubectl delete -f k8s/typescript/deployment.yaml || true

status:
	kubectl get deployment
	kubectl get pods
	kubectl get service

