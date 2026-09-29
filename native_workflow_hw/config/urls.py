from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.urls import path


@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok"})


urlpatterns = [
    path("", health_check, name="health-check"),
]
