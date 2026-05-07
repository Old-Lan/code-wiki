package handler

import (
	"encoding/json"
	"net/http"
)

type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type Handler struct {
	Port int
}

func NewHandler() *Handler {
	return &Handler{Port: 8080}
}

func (h *Handler) Serve() error {
	return nil
}

func (h *Handler) Respond(w http.ResponseWriter, r *http.Request) {
	resp := Response{Status: "ok", Message: "hello"}
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) HandleRequest(req Request) (Response, error) {
	return Response{Status: "ok", Message: req.Body}, nil
}
